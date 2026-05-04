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
      if (mounted && saved != null && saved.isNotEmpty) state = saved;
    } catch (_) {
      // Any error (timeout, keychain issue) → keep using default URL.
    }
  }

  Future<void> setUrl(String url) async {
    final trimmed = url.trim().replaceAll(RegExp(r'/$'), '');
    await _storage.saveServerUrl(trimmed);
    state = trimmed;
  }

  Future<void> reset() async {
    await _storage.clearServerUrl();
    state = kApiBaseUrl;
  }
}
