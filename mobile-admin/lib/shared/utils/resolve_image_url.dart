/// Builds an absolute URL for invite card images from the mobile API base URL.
/// [imagePath] may be a site-relative path (`/...`) or an absolute `http(s)` URL.
String? resolvePublicImageUrl(String mobileApiBaseUrl, String? imagePath) {
  if (imagePath == null) return null;
  final t = imagePath.trim();
  if (t.isEmpty) return null;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (!t.startsWith('/')) return null;
  final base = Uri.parse(mobileApiBaseUrl);
  if (!base.hasScheme || base.host.isEmpty) return null;
  final port = base.hasPort ? ':${base.port}' : '';
  return '${base.scheme}://${base.host}$port$t';
}
