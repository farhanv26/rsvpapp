import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../storage/secure_storage.dart';

final serverUrlProvider =
    StateNotifierProvider<ServerUrlNotifier, String>((ref) {
  return ServerUrlNotifier(ref.watch(secureStorageProvider));
});

class ServerUrlNotifier extends StateNotifier<String> {
  ServerUrlNotifier(this._storage) : super(kApiBaseUrl) {
    // Load the saved URL in the background — does NOT block app startup.
    _loadSaved();
  }

  final SecureStorage _storage;

  Future<void> _loadSaved() async {
    try {
      final saved = await _storage.getServerUrl()
          .timeout(const Duration(seconds: 4));
      if (mounted && saved != null && saved.isNotEmpty) {
        state = saved;
      }
    } catch (_) {
      // Any error (timeout, keychain issue) → keep using default URL.
    }
  }

  Future<void> setUrl(String url) async {
    final normalized = _normalizeApiUrl(url);
    final uri = Uri.tryParse(normalized);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      throw const FormatException('Invalid server URL');
    }
    if (uri.scheme != 'http' && uri.scheme != 'https') {
      throw const FormatException('Invalid server URL scheme');
    }
    await _storage.saveServerUrl(normalized);
    state = normalized;
  }

  Future<void> reset() async {
    await _storage.clearServerUrl();
    state = kApiBaseUrl;
  }

  String _normalizeApiUrl(String input) {
    final cleaned = input.trim().replaceAll(RegExp(r'/$'), '');
    final uri = Uri.tryParse(cleaned);
    if (uri == null) return cleaned;
    if (!uri.hasScheme || uri.host.isEmpty) return cleaned;

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
