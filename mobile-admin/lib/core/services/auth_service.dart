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
    final cachedUserJson = await _storage.getAdminUser();
    if (cachedUserJson != null) {
      try {
        final cachedUser = AdminUser.fromJson(cachedUserJson);
        state = cachedUser;

        // Attach JWT immediately so API calls work before background /auth.
        try {
          final token = await _storage.getToken().timeout(const Duration(seconds: 12));
          if (token != null && token.isNotEmpty) {
            _authService.setSessionToken(token);
          }
        } catch (_) {
          // Token read can fail transiently; background rehydrate retries.
        }

        // Keep the user signed in instantly on app restart, then revalidate
        // in the background without blocking startup.
        unawaited(_rehydrateSessionInBackground());
        return;
      } catch (_) {
        // Ignore corrupt cached user and continue with token check.
      }
    }

    String? token;
    try {
      token = await _storage.getToken().timeout(const Duration(seconds: 12));
    } catch (_) {
      // If we already restored cached user, keep user in-app and retry token
      // loading on next launch.
      return;
    }
    if (token == null) {
      // Keep cached user signed-in; token can fail to load intermittently on
      // some devices during cold start.
      return;
    }
    _authService.setSessionToken(token);

    try {
      final user = await _authService.meWithToken(token).timeout(const Duration(seconds: 10));
      state = user;
      await _storage.saveAdminUser(user.toJson());
    } on ApiException catch (e) {
      if (e.isUnauthorized || e.isForbidden) {
        await _storage.deleteAdminUser();
        await _storage.deleteToken();
        state = null;
      }
    } catch (_) {
      // Network/timeout errors — keep token, retry on next launch.
    }
  }

  Future<void> _rehydrateSessionInBackground() async {
    String? token;
    try {
      token = await _storage.getToken().timeout(const Duration(seconds: 8));
    } catch (_) {
      return;
    }
    if (token == null) return;
    _authService.setSessionToken(token);
    try {
      final user = await _authService.meWithToken(token).timeout(const Duration(seconds: 10));
      state = user;
      await _storage.saveAdminUser(user.toJson());
    } on ApiException catch (e) {
      if (e.isUnauthorized || e.isForbidden) {
        await _storage.deleteAdminUser();
        await _storage.deleteToken();
        state = null;
      }
    } catch (_) {
      // Keep cached session on transient failures.
    }
  }

  Future<void> login(AdminUser user) async {
    state = user;
    await _storage.saveAdminUser(user.toJson());
  }

  Future<void> logout() async {
    _authService.clearSessionToken();
    await _storage.deleteAdminUser();
    await _storage.deleteToken();
    state = null;
  }
}

class AuthService {
  const AuthService(this._client, this._storage);

  final ApiClient _client;
  final SecureStorage _storage;
  static const _requestTimeout = Duration(seconds: 15);

  Future<AdminUser> login(String username, String password) async {
    try {
      final res = await _client.post<Map<String, dynamic>>(
        '/auth',
        data: {'username': username, 'password': password},
      ).timeout(_requestTimeout);
      final data = res.data!;
      final token = data['token'] as String;
      _client.setAuthToken(token);
      await _storage.saveToken(token);
      final user = AdminUser.fromJson(data['user'] as Map<String, dynamic>);
      await _storage.saveAdminUser(user.toJson());
      return user;
    } on TimeoutException {
      throw const ApiException('Login request timed out. Check your connection.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<AdminUser> me() async {
    try {
      final res = await _client.get<Map<String, dynamic>>('/auth').timeout(_requestTimeout);
      return AdminUser.fromJson((res.data!['user']) as Map<String, dynamic>);
    } on TimeoutException {
      throw const ApiException('Session check timed out. Please retry.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<AdminUser> meWithToken(String token) async {
    try {
      final res = await _client
          .get<Map<String, dynamic>>(
            '/auth',
            options: Options(headers: {'Authorization': 'Bearer $token'}),
          )
          .timeout(_requestTimeout);
      return AdminUser.fromJson((res.data!['user']) as Map<String, dynamic>);
    } on TimeoutException {
      throw const ApiException('Session check timed out. Please retry.');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  void setSessionToken(String token) {
    _client.setAuthToken(token);
  }

  void clearSessionToken() {
    _client.clearAuthToken();
  }
}
