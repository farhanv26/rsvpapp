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

  // Reuses the existing /admin/api/notifications endpoint (not under /mobile/).
  Future<NotificationsResult> listNotifications({int limit = 30}) async {
    try {
      final res = await _client.get<Map<String, dynamic>>(
        // Step out of /mobile prefix and use the shared endpoint
        '/../notifications',
        queryParameters: {'limit': limit},
      );
      final data = res.data!;
      final list = (data['notifications'] as List<dynamic>)
          .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
          .toList();
      return NotificationsResult(
        notifications: list,
        unreadCount: (data['unreadCount'] as num?)?.toInt() ?? 0,
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> markRead({String? id, bool all = false}) async {
    try {
      await _client.post<void>(
        '/../notifications/read',
        data: all ? {'all': true} : {'id': id},
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}
