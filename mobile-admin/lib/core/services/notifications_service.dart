import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/notification.dart';

final notificationsServiceProvider =
    Provider<NotificationsService>((ref) => NotificationsService(ref.watch(apiClientProvider)));

final notificationsProvider = FutureProvider<NotificationsResult>((ref) async {
  return ref.watch(notificationsServiceProvider).listNotifications();
});

class NotificationsResult {
  const NotificationsResult({required this.notifications, required this.unreadCount});
  final List<AppNotification> notifications;
  final int unreadCount;
}

class NotificationsService {
  const NotificationsService(this._client);

  final ApiClient _client;
  static const _requestTimeout = Duration(seconds: 12);

  // Reuses /admin/api/notifications (sibling of /mobile); use relative path so
  // Dio resolves to .../admin/api/notifications (not site root).
  Future<NotificationsResult> listNotifications({int take = 30}) async {
    try {
      final res = await _client.get<Map<String, dynamic>>(
        '../notifications',
        queryParameters: {'take': take},
      ).timeout(_requestTimeout);
      final data = res.data!;
      final rawList = data['items'] ?? data['notifications'];
      if (rawList is! List<dynamic>) {
        throw const ApiException('Unexpected response from notifications.');
      }
      final list = rawList
          .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
          .toList();
      return NotificationsResult(
        notifications: list,
        unreadCount: (data['unreadCount'] as num?)?.toInt() ?? 0,
      );
    } on TimeoutException {
      throw const ApiException('Notifications request timed out. Pull to retry.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> markRead({String? id, bool all = false}) async {
    try {
      await _client.post<void>(
        '../notifications/read',
        data: all ? {'all': true} : {'id': id},
      ).timeout(_requestTimeout);
    } on TimeoutException {
      throw const ApiException('Mark read request timed out. Try again.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}
