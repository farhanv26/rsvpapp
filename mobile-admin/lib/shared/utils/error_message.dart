import '../../core/api/api_client.dart';

/// User-facing error text without noisy exception wrappers or literal "null".
String userFacingErrorMessage(Object error) {
  if (error is ApiException) {
    final m = error.message.trim();
    return m.isEmpty ? 'Something went wrong. Please try again.' : m;
  }
  var s = error.toString().trim();
  s = s.replaceFirst(RegExp(r'^ApiException\([^)]*\):\s*'), '');
  s = s.replaceAll(RegExp(r'\(null\)'), '').replaceAll('null', '').trim();
  if (s.isEmpty) return 'Something went wrong. Please try again.';
  return s;
}
