import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/secure_storage.dart';

// Update this to your server URL. In development, use your local IP so the
// device/simulator can reach the Next.js dev server (not 'localhost').
const String kBaseUrl = 'http://192.168.68.123:3000/admin/api/mobile';

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return ApiClient(storage);
});

class ApiClient {
  ApiClient(this._storage) {
    _dio = Dio(BaseOptions(
      baseUrl: kBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        handler.next(error);
      },
    ));
  }

  final SecureStorage _storage;
  late final Dio _dio;

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? queryParameters}) =>
      _dio.get<T>(path, queryParameters: queryParameters);

  Future<Response<T>> post<T>(String path, {dynamic data}) =>
      _dio.post<T>(path, data: data);
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
  final message = (body is Map && body['error'] is String)
      ? body['error'] as String
      : e.message ?? 'Network error';
  return ApiException(message, statusCode: code);
}
