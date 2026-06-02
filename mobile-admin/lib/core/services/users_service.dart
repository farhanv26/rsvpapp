import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/admin_user.dart';

final usersServiceProvider =
    Provider<UsersService>((ref) => UsersService(ref.watch(apiClientProvider)));

final managedUsersProvider = FutureProvider<List<ManagedUser>>((ref) async {
  return ref.watch(usersServiceProvider).listUsers();
});

final deletedEventsProvider = FutureProvider<List<DeletedEvent>>((ref) async {
  return ref.watch(usersServiceProvider).listDeletedEvents();
});

class UsersService {
  const UsersService(this._client);
  final ApiClient _client;
  static const _timeout = Duration(seconds: 15);

  Future<List<ManagedUser>> listUsers() async {
    try {
      final res = await _client.get<Map<String, dynamic>>('/users').timeout(_timeout);
      final list = res.data!['users'] as List<dynamic>;
      return list.map((e) => ManagedUser.fromJson(e as Map<String, dynamic>)).toList();
    } on TimeoutException {
      throw const ApiException('Request timed out.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<ManagedUser> createUser({
    required String name,
    required String email,
    required String password,
    required String role,
  }) async {
    try {
      final res = await _client.post<Map<String, dynamic>>('/users', data: {
        'name': name,
        'email': email,
        'password': password,
        'role': role,
      }).timeout(_timeout);
      return ManagedUser.fromJson(res.data!['user'] as Map<String, dynamic>);
    } on TimeoutException {
      throw const ApiException('Request timed out.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<ManagedUser> updateUser(String userId, Map<String, dynamic> data) async {
    try {
      final res = await _client
          .put<Map<String, dynamic>>('/users/$userId', data: data)
          .timeout(_timeout);
      return ManagedUser.fromJson(res.data!['user'] as Map<String, dynamic>);
    } on TimeoutException {
      throw const ApiException('Request timed out.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> deleteUser(String userId) async {
    try {
      await _client.delete<void>('/users/$userId').timeout(_timeout);
    } on TimeoutException {
      throw const ApiException('Request timed out.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<DeletedEvent>> listDeletedEvents() async {
    try {
      final res = await _client
          .get<Map<String, dynamic>>('/events/deleted')
          .timeout(_timeout);
      final list = res.data!['events'] as List<dynamic>;
      return list.map((e) => DeletedEvent.fromJson(e as Map<String, dynamic>)).toList();
    } on TimeoutException {
      throw const ApiException('Request timed out.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> restoreEvent(String eventId) async {
    try {
      await _client.post<void>('/events/$eventId/restore').timeout(_timeout);
    } on TimeoutException {
      throw const ApiException('Request timed out.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}
