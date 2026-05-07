import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _tokenKey = 'admin_jwt';
const _adminUserKey = 'admin_user';
const _serverUrlKey = 'server_url';

final secureStorageProvider = Provider<SecureStorage>((ref) => SecureStorage());

class SecureStorage {
  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
  );
  Future<SharedPreferences> get _prefs async => SharedPreferences.getInstance();
  String? _cachedToken;
  bool _tokenLoaded = false;

  Future<void> saveToken(String token) async {
    _cachedToken = token;
    _tokenLoaded = true;
    try {
      final prefs = await _prefs;
      await prefs.setString(_tokenKey, token);
    } catch (_) {
      // Ignore prefs failures.
    }
    try {
      await _storage.write(key: _tokenKey, value: token);
    } catch (_) {
      // Ignore storage write failures; caller should not crash.
    }
  }

  Future<String?> getToken() async {
    if (_tokenLoaded) return _cachedToken;
    String? token;
    try {
      final prefs = await _prefs;
      token = prefs.getString(_tokenKey);
    } catch (_) {
      token = null;
    }
    if (token != null && token.isNotEmpty) {
      _cachedToken = token;
      _tokenLoaded = true;
      return token;
    }
    try {
      token = await _storage.read(key: _tokenKey);
    } catch (_) {
      token = null;
    }
    if (token != null && token.isNotEmpty) {
      try {
        final prefs = await _prefs;
        await prefs.setString(_tokenKey, token);
      } catch (_) {
        // Ignore prefs failures.
      }
    }
    _cachedToken = token;
    _tokenLoaded = true;
    return token;
  }

  Future<void> deleteToken() async {
    _cachedToken = null;
    _tokenLoaded = true;
    try {
      final prefs = await _prefs;
      await prefs.remove(_tokenKey);
    } catch (_) {
      // Ignore prefs delete failures.
    }
    try {
      await _storage.delete(key: _tokenKey);
    } catch (_) {
      // Ignore storage delete failures; caller should not crash.
    }
  }

  Future<void> saveAdminUser(Map<String, dynamic> userJson) async {
    final raw = jsonEncode(userJson);
    try {
      final prefs = await _prefs;
      await prefs.setString(_adminUserKey, raw);
    } catch (_) {
      // Ignore prefs failures.
    }
    try {
      await _storage.write(key: _adminUserKey, value: raw);
    } catch (_) {
      // Ignore storage write failures; caller should not crash.
    }
  }

  Future<Map<String, dynamic>?> getAdminUser() async {
    String? raw;
    try {
      final prefs = await _prefs;
      raw = prefs.getString(_adminUserKey);
    } catch (_) {
      raw = null;
    }
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) return decoded;
      } catch (_) {
        // Fall through to secure storage read.
      }
    }
    try {
      raw = await _storage.read(key: _adminUserKey);
    } catch (_) {
      raw = null;
    }
    if (raw == null || raw.isEmpty) return null;
    try {
      final prefs = await _prefs;
      await prefs.setString(_adminUserKey, raw);
    } catch (_) {
      // Ignore prefs failures.
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<void> deleteAdminUser() async {
    try {
      final prefs = await _prefs;
      await prefs.remove(_adminUserKey);
    } catch (_) {
      // Ignore prefs delete failures.
    }
    try {
      await _storage.delete(key: _adminUserKey);
    } catch (_) {
      // Ignore storage delete failures; caller should not crash.
    }
  }

  Future<void> saveServerUrl(String url) async {
    try {
      await _storage.write(key: _serverUrlKey, value: url);
    } catch (_) {
      // Ignore storage write failures; caller should not crash.
    }
  }

  Future<String?> getServerUrl() async {
    String? url;
    try {
      url = await _storage.read(key: _serverUrlKey);
    } catch (_) {
      url = null;
    }
    final normalized = _normalizeServerUrl(url);
    if (normalized == null) {
      try {
        await _storage.delete(key: _serverUrlKey);
      } catch (_) {
        // Ignore storage cleanup failures for invalid URL entries.
      }
      return null;
    }
    if (normalized != url) {
      try {
        await _storage.write(key: _serverUrlKey, value: normalized);
      } catch (_) {
        // Ignore storage write failures; caller should not crash.
      }
    }
    return normalized;
  }

  Future<void> clearServerUrl() async {
    try {
      await _storage.delete(key: _serverUrlKey);
    } catch (_) {
      // Ignore storage delete failures; caller should not crash.
    }
  }

  String? _normalizeServerUrl(String? input) {
    if (input == null) return null;
    final trimmed = input.trim().replaceAll(RegExp(r'/$'), '');
    if (trimmed.isEmpty) return null;
    final uri = Uri.tryParse(trimmed);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) return null;
    if (uri.scheme != 'http' && uri.scheme != 'https') return null;

    const requiredSuffix = '/admin/api/mobile';
    final path = uri.path.isEmpty ? '' : uri.path;
    final hasSuffix = path.endsWith(requiredSuffix);
    final normalizedPath = hasSuffix
        ? path
        : path.isEmpty
            ? requiredSuffix
            : '$path$requiredSuffix';
    return uri.replace(path: normalizedPath, query: null, fragment: null).toString().replaceAll(RegExp(r'/$'), '');
  }
}
