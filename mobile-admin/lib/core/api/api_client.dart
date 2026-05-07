import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/server_config.dart';

// Default URL — used when no URL has been saved.
// Override at build time: flutter run --dart-define=API_URL=http://192.168.x.x:3000/admin/api/mobile
// Or configure at runtime via the login screen.
const String kApiBaseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://farhanrafiya.vercel.app/admin/api/mobile',
);

// apiClientProvider recreates whenever serverUrlProvider changes (user saves a new URL).
final apiClientProvider = Provider<ApiClient>((ref) {
  final baseUrl = ref.watch(serverUrlProvider);
  return ApiClient(baseUrl: baseUrl);
});

class ApiClient {
  static String? _inMemoryToken;

  ApiClient({String? baseUrl}) {
    final url = (baseUrl?.isNotEmpty == true) ? baseUrl! : kApiBaseUrl;
    _dio = Dio(BaseOptions(
      baseUrl: url,
      connectTimeout: const Duration(seconds: 12),
      sendTimeout: const Duration(seconds: 12),
      receiveTimeout: const Duration(seconds: 25),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = _inMemoryToken;
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) => handler.next(error),
    ));
  }

  late final Dio _dio;

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) =>
      _dio.get<T>(path, queryParameters: queryParameters, options: options);

  Future<Response<T>> post<T>(String path, {dynamic data, Options? options}) =>
      _dio.post<T>(path, data: data, options: options);

  Future<Response<T>> put<T>(String path, {dynamic data, Options? options}) =>
      _dio.put<T>(path, data: data, options: options);

  Future<Response<T>> delete<T>(String path, {dynamic data, Options? options}) =>
      _dio.delete<T>(path, data: data, options: options);

  String get baseUrl => _dio.options.baseUrl;

  void setAuthToken(String? token) {
    _inMemoryToken = token;
  }

  void clearAuthToken() {
    _inMemoryToken = null;
  }
}

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => 'ApiException($statusCode): $message';

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
}

ApiException mapDioError(DioException e) {
  final code = e.response?.statusCode;
  final body = e.response?.data;
  String message;
  if (body is Map && body['error'] is String) {
    message = (body['error'] as String).trim();
  } else if (e.type == DioExceptionType.connectionTimeout ||
      e.type == DioExceptionType.receiveTimeout ||
      e.type == DioExceptionType.sendTimeout) {
    message = 'Request timed out. Check your connection.';
  } else if (e.type == DioExceptionType.connectionError) {
    message = 'Could not reach the server. Check URL and network.';
  } else {
    final raw = e.message?.trim();
    message = (raw != null && raw.isNotEmpty) ? raw : 'Could not complete the request.';
  }
  return ApiException(message, statusCode: code);
}
