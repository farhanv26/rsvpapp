import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/admin_user.dart';
import '../storage/secure_storage.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(ref.watch(apiClientProvider), ref.watch(secureStorageProvider));
});

final currentUserProvider = StateNotifierProvider<CurrentUserNotifier, AdminUser?>((ref) {
  return CurrentUserNotifier(ref.watch(authServiceProvider), ref.watch(secureStorageProvider));
});

class CurrentUserNotifier extends StateNotifier<AdminUser?> {
  CurrentUserNotifier(this._authService, this._storage) : super(null);

  final AuthService _authService;
  final SecureStorage _storage;

  Future<void> loadFromStorage() async {
    String? token;
    try {
      token = await _storage.getToken().timeout(const Duration(seconds: 5));
    } catch (_) {
      return; // Storage unavailable — treat as logged out.
    }
    if (token == null) return;
    try {
      final user = await _authService.me().timeout(const Duration(seconds: 10));
      state = user;
    } on ApiException catch (e) {
      if (e.isUnauthorized || e.isForbidden) {
        await _storage.deleteToken();
      }
    } catch (_) {
      // Network/timeout errors — keep token, retry on next launch.
    }
  }

  Future<void> login(AdminUser user) async => state = user;

  Future<void> logout() async {
    await _storage.deleteToken();
    state = null;
  }
}

class AuthService {
  const AuthService(this._client, this._storage);

  final ApiClient _client;
  final SecureStorage _storage;

  Future<AdminUser> login(String username, String password) async {
    try {
      final res = await _client.post<Map<String, dynamic>>(
        '/auth',
        data: {'username': username, 'password': password},
      );
      final data = res.data!;
      final token = data['token'] as String;
      await _storage.saveToken(token);
      return AdminUser.fromJson(data['user'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<AdminUser> me() async {
    try {
      final res = await _client.get<Map<String, dynamic>>('/auth');
      return AdminUser.fromJson((res.data!['user']) as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}
