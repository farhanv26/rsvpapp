import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/config/server_config.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/notifications_service.dart';
import '../../shared/theme/app_theme.dart';
import '../events/events_list_screen.dart';
import '../notifications/notifications_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _tab = 0;

  void _goToNotifications() => setState(() => _tab = 1);

  @override
  Widget build(BuildContext context) {
    final unread = ref.watch(notificationsProvider).valueOrNull?.unreadCount ?? 0;

    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: AppColors.surface,
      systemNavigationBarIconBrightness: Brightness.dark,
    ));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: IndexedStack(
        index: _tab,
        children: [
          EventsListScreen(onNotificationsTap: _goToNotifications),
          const NotificationsScreen(),
          const _AccountTab(),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.border, width: 1)),
        ),
        child: SafeArea(
          top: false,
          child: NavigationBar(
            selectedIndex: _tab,
            onDestinationSelected: (i) => setState(() => _tab = i),
            destinations: [
              const NavigationDestination(
                icon: Icon(Icons.event_note_outlined),
                selectedIcon: Icon(Icons.event_note_rounded),
                label: 'Events',
              ),
              NavigationDestination(
                icon: unread > 0
                    ? Badge(
                        backgroundColor: AppColors.declined,
                        label: Text(
                          unread > 9 ? '9+' : '$unread',
                          style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700),
                        ),
                        child: const Icon(Icons.notifications_outlined),
                      )
                    : const Icon(Icons.notifications_outlined),
                selectedIcon: const Icon(Icons.notifications_rounded),
                label: 'Notifications',
              ),
              const NavigationDestination(
                icon: Icon(Icons.person_outline_rounded),
                selectedIcon: Icon(Icons.person_rounded),
                label: 'Account',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Account tab ────────────────────────────────────────────────────

class _AccountTab extends ConsumerWidget {
  const _AccountTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final serverUrl = ref.watch(serverUrlProvider);
    final initial = user?.name.isNotEmpty == true ? user!.name[0].toUpperCase() : '?';
    final displayName = user?.name ?? 'Admin';
    final role = user?.role ?? '';

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Account', style: AppTextStyles.titleLarge),
                    const SizedBox(height: 24),

                    // User card
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        border: Border.all(color: AppColors.border),
                        boxShadow: AppShadows.card,
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [AppColors.brandAccentBright, AppColors.brandAccent],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Center(
                              child: Text(
                                initial,
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textOnAccent,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(displayName, style: AppTextStyles.titleSmall),
                                const SizedBox(height: 4),
                                if (role.isNotEmpty)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppColors.brandAccentLight,
                                      borderRadius: BorderRadius.circular(AppRadius.pill),
                                      border: Border.all(color: AppColors.brandAccent.withValues(alpha: 0.3)),
                                    ),
                                    child: Text(
                                      _formatRole(role),
                                      style: const TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.brandAccent,
                                        letterSpacing: 0.3,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),
                    const Text('SERVER', style: AppTextStyles.sectionLabel),
                    const SizedBox(height: 10),

                    // Server config card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        border: Border.all(color: AppColors.border),
                        boxShadow: AppShadows.card,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceMuted,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(Icons.dns_outlined, size: 18, color: AppColors.textSecondary),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('API Server', style: AppTextStyles.titleSmall),
                                    const SizedBox(height: 2),
                                    Text(
                                      serverUrl.isNotEmpty ? serverUrl : 'Not configured',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.textMuted,
                                        fontFamily: 'monospace',
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: () => _showServerConfig(context, ref),
                              icon: const Icon(Icons.edit_outlined, size: 16),
                              label: const Text('Configure Server'),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 11),
                                textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                minimumSize: Size.zero,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),
                    const Text('SESSION', style: AppTextStyles.sectionLabel),
                    const SizedBox(height: 10),

                    // Sign out button
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        border: Border.all(color: AppColors.border),
                        boxShadow: AppShadows.card,
                      ),
                      child: Material(
                        color: Colors.transparent,
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        child: InkWell(
                          onTap: () => _confirmLogout(context, ref),
                          borderRadius: BorderRadius.circular(AppRadius.lg),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: AppColors.dangerBg,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(Icons.logout_rounded, size: 18, color: AppColors.danger),
                                ),
                                const SizedBox(width: 12),
                                const Expanded(
                                  child: Text(
                                    'Sign out',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w500,
                                      color: AppColors.danger,
                                    ),
                                  ),
                                ),
                                const Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.textMuted),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 48),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatRole(String role) {
    return role.replaceAll('_', ' ').toUpperCase();
  }

  void _showServerConfig(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ServerConfigSheet(
        currentUrl: ref.read(serverUrlProvider),
        onSave: (url) async {
          await ref.read(serverUrlProvider.notifier).setUrl(url);
        },
        onReset: () async {
          await ref.read(serverUrlProvider.notifier).reset();
        },
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You will return to the login screen.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirmed == true) await ref.read(currentUserProvider.notifier).logout();
  }
}

// ── Server config bottom sheet ─────────────────────────────────────

class _ServerConfigSheet extends ConsumerStatefulWidget {
  const _ServerConfigSheet({
    required this.currentUrl,
    required this.onSave,
    required this.onReset,
  });
  final String currentUrl;
  final Future<void> Function(String) onSave;
  final Future<void> Function() onReset;

  @override
  ConsumerState<_ServerConfigSheet> createState() => _ServerConfigSheetState();
}

class _ServerConfigSheetState extends ConsumerState<_ServerConfigSheet> {
  late final TextEditingController _urlCtrl;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _urlCtrl = TextEditingController(text: widget.currentUrl);
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    super.dispose();
  }

  Future<void> _reset() async {
    setState(() => _saving = true);
    await widget.onReset();
    if (mounted) Navigator.pop(context);
  }

  Future<void> _save() async {
    final url = _urlCtrl.text.trim();
    if (url.isEmpty) {
      setState(() => _error = 'Enter a URL.');
      return;
    }
    if (!url.startsWith('http')) {
      setState(() => _error = 'Must start with http:// or https://');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.onSave(url);
      if (mounted) Navigator.pop(context);
    } catch (_) {
      if (mounted) setState(() { _saving = false; _error = 'Invalid or unreachable URL.'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottom),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.xxl),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const Text('Server Configuration', style: AppTextStyles.titleSmall),
          const SizedBox(height: 6),
          const Text(
            'Point to your RSVP server. If you enter only a domain/IP, the app auto-appends /admin/api/mobile.\n• Simulator: http://localhost:3000\n• Physical device: use your Mac\'s local IP instead of localhost',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12, height: 1.5),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _urlCtrl,
            keyboardType: TextInputType.url,
            textInputAction: TextInputAction.done,
            autocorrect: false,
            onSubmitted: (_) => _save(),
            style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
            decoration: InputDecoration(
              labelText: 'API URL',
              hintText: 'http://localhost:3000',
              errorText: _error,
              prefixIcon: const Icon(Icons.dns_outlined, size: 20),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _saving ? null : _reset,
                  child: const Text('Reset'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textOnAccent))
                      : const Text('Save'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
