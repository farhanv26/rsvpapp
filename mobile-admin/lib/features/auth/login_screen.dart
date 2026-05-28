import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_client.dart';
import '../../core/config/server_config.dart';
import '../../core/services/auth_service.dart';
import '../../shared/theme/app_theme.dart';

final _adminUsersProvider = FutureProvider<List<String>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client
        .get<Map<String, dynamic>>('/auth/users')
        .timeout(const Duration(seconds: 12));
    final list = res.data!['users'] as List<dynamic>;
    return list.cast<String>();
  } on TimeoutException {
    throw const ApiException('Loading users timed out. Check server settings and retry.');
  } on DioException catch (e) {
    throw mapDioError(e);
  }
});

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  String? _selectedUser;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 280),
      transitionBuilder: (child, animation) {
        final toRight = child.key == const ValueKey('users');
        return SlideTransition(
          position: Tween<Offset>(
            begin: toRight ? const Offset(-0.06, 0) : const Offset(0.06, 0),
            end: Offset.zero,
          ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
          child: FadeTransition(opacity: animation, child: child),
        );
      },
      child: _selectedUser == null
          ? _UserSelectStep(
              key: const ValueKey('users'),
              onUserSelected: (u) => setState(() => _selectedUser = u),
            )
          : _PasswordStep(
              key: const ValueKey('password'),
              username: _selectedUser!,
              onBack: () => setState(() => _selectedUser = null),
            ),
    );
  }
}

// ── Step 1: User select ────────────────────────────────────────────

class _UserSelectStep extends ConsumerStatefulWidget {
  const _UserSelectStep({super.key, required this.onUserSelected});
  final void Function(String) onUserSelected;

  @override
  ConsumerState<_UserSelectStep> createState() => _UserSelectStepState();
}

class _UserSelectStepState extends ConsumerState<_UserSelectStep> {
  final _usernameCtrl = TextEditingController();

  @override
  void dispose() {
    _usernameCtrl.dispose();
    super.dispose();
  }

  void _showServerConfig() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ServerConfigSheet(
        currentUrl: ref.read(serverUrlProvider),
        onSave: (url) async {
          await ref.read(serverUrlProvider.notifier).setUrl(url);
          ref.invalidate(_adminUsersProvider);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final usersAsync = ref.watch(_adminUsersProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 52),

              // Logo mark
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.brandAccentBright, AppColors.brandAccent],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(15),
                  boxShadow: AppShadows.button,
                ),
                child: const Icon(Icons.event_note_rounded, color: AppColors.textOnAccent, size: 24),
              ),

              const SizedBox(height: 24),
              const Text('Welcome back', style: AppTextStyles.headlineDisplay),
              const SizedBox(height: 6),
              const Text(
                'Select your account to continue.',
                style: TextStyle(fontSize: 15, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 32),

              Expanded(
                child: usersAsync.when(
                  loading: () => const Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandAccent),
                    ),
                  ),
                  data: (users) => ListView.separated(
                    itemCount: users.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _UserTile(
                      name: users[i],
                      onTap: () => widget.onUserSelected(users[i]),
                    ),
                  ),
                  error: (_, __) => SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.dangerBg,
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.wifi_off_rounded, color: AppColors.danger, size: 18),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      "Can't reach server",
                                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.danger),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      ref.watch(serverUrlProvider),
                                      style: const TextStyle(fontSize: 11, color: AppColors.danger, fontFamily: 'monospace'),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: _ActionButton(
                                icon: Icons.refresh_rounded,
                                label: 'Retry',
                                onTap: () => ref.invalidate(_adminUsersProvider),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _ActionButton(
                                icon: Icons.dns_outlined,
                                label: 'Configure',
                                filled: true,
                                onTap: _showServerConfig,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 28),
                        const Row(children: [
                          Expanded(child: Divider(color: AppColors.border)),
                          Padding(
                            padding: EdgeInsets.symmetric(horizontal: 12),
                            child: Text('or enter manually', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                          ),
                          Expanded(child: Divider(color: AppColors.border)),
                        ]),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _usernameCtrl,
                          autocorrect: false,
                          textInputAction: TextInputAction.go,
                          onSubmitted: (_) => _continueManual(),
                          onChanged: (_) => setState(() {}),
                          style: const TextStyle(color: AppColors.textPrimary),
                          decoration: const InputDecoration(
                            labelText: 'Username',
                            prefixIcon: Icon(Icons.person_outline_rounded, size: 20),
                          ),
                        ),
                        const SizedBox(height: 12),
                        _PrimaryButton(
                          label: 'Continue',
                          enabled: _usernameCtrl.text.trim().isNotEmpty,
                          onTap: _continueManual,
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              Center(
                child: GestureDetector(
                  onTap: _showServerConfig,
                  child: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.dns_outlined, size: 12, color: AppColors.textMuted),
                        SizedBox(width: 5),
                        Text(
                          'Server settings',
                          style: TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _continueManual() {
    final name = _usernameCtrl.text.trim();
    if (name.isNotEmpty) widget.onUserSelected(name);
  }
}

// ── User tile ──────────────────────────────────────────────────────

class _UserTile extends StatelessWidget {
  const _UserTile({required this.name, required this.onTap});
  final String name;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
    return Material(
      color: AppColors.surfaceCard,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.brandDeep,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    initial,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textInverse,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  name,
                  style: AppTextStyles.titleSmall,
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded, size: 13, color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Step 2: Password ───────────────────────────────────────────────

class _PasswordStep extends ConsumerStatefulWidget {
  const _PasswordStep({super.key, required this.username, required this.onBack});
  final String username;
  final VoidCallback onBack;

  @override
  ConsumerState<_PasswordStep> createState() => _PasswordStepState();
}

class _PasswordStepState extends ConsumerState<_PasswordStep> {
  final _pwCtrl = TextEditingController();
  final _pwFocus = FocusNode();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _pwFocus.requestFocus());
  }

  @override
  void dispose() {
    _pwCtrl.dispose();
    _pwFocus.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_pwCtrl.text.isEmpty) {
      setState(() => _error = 'Enter your password.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = await ref.read(authServiceProvider).login(widget.username, _pwCtrl.text);
      await ref.read(currentUserProvider.notifier).login(user);
    } on ApiException catch (e) {
      setState(() => _error = e.isUnauthorized ? 'Incorrect password.' : 'Cannot reach server — check Server settings.');
    } catch (_) {
      setState(() => _error = 'Cannot reach server — check Server settings.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 52),

              GestureDetector(
                onTap: widget.onBack,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceCard,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: const Icon(Icons.arrow_back_ios_new_rounded, size: 14, color: AppColors.textSecondary),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Back',
                      style: TextStyle(fontSize: 14, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 36),

              // User avatar
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: AppColors.brandDeep,
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Center(
                  child: Text(
                    widget.username.isNotEmpty ? widget.username[0].toUpperCase() : '?',
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textInverse,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 18),
              Text(widget.username, style: AppTextStyles.headlineDisplay),
              const SizedBox(height: 4),
              const Text(
                'Enter your password to sign in.',
                style: TextStyle(fontSize: 15, color: AppColors.textSecondary),
              ),

              const SizedBox(height: 32),

              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _error!,
                          style: const TextStyle(color: AppColors.danger, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
              ],

              TextField(
                controller: _pwCtrl,
                focusNode: _pwFocus,
                obscureText: _obscure,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _login(),
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  labelText: 'Password',
                  prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                  suffixIcon: IconButton(
                    onPressed: () => setState(() => _obscure = !_obscure),
                    icon: Icon(
                      _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                      size: 20,
                      color: AppColors.textMuted,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 24),

              _PrimaryButton(
                label: 'Sign in',
                loading: _loading,
                onTap: _login,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Shared UI components ───────────────────────────────────────────

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.label,
    required this.onTap,
    this.loading = false,
    this.enabled = true,
  });
  final String label;
  final VoidCallback onTap;
  final bool loading;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: (loading || !enabled) ? null : onTap,
      child: AnimatedOpacity(
        opacity: (loading || !enabled) ? 0.45 : 1.0,
        duration: const Duration(milliseconds: 150),
        child: Container(
          width: double.infinity,
          height: 52,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.brandAccentBright, AppColors.brandAccent],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadius.lg),
            boxShadow: AppShadows.button,
          ),
          child: Center(
            child: loading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textOnAccent),
                  )
                : Text(
                    label,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textOnAccent,
                      letterSpacing: -0.2,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.filled = false,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          gradient: filled
              ? const LinearGradient(
                  colors: [AppColors.brandAccentBright, AppColors.brandAccent],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: filled ? null : AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: filled ? Colors.transparent : AppColors.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 14, color: filled ? AppColors.textOnAccent : AppColors.textSecondary),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: filled ? AppColors.textOnAccent : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Server config sheet ────────────────────────────────────────────

class _ServerConfigSheet extends ConsumerStatefulWidget {
  const _ServerConfigSheet({required this.currentUrl, required this.onSave});
  final String currentUrl;
  final Future<void> Function(String) onSave;

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
          const Text('Server URL', style: AppTextStyles.titleSmall),
          const SizedBox(height: 6),
          const Text(
            'Point to your RSVP server.\nIf you enter only a domain/IP, the app auto-appends /admin/api/mobile.\n• Simulator: http://localhost:3000\n• Physical device: use your Mac\'s local IP instead of localhost',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12, height: 1.5),
          ),
          const SizedBox(height: 14),
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
          _PrimaryButton(label: 'Save', loading: _saving, onTap: _save),
          const SizedBox(height: 10),
          Center(
            child: GestureDetector(
              onTap: _saving
                  ? null
                  : () async {
                      final nav = Navigator.of(context);
                      setState(() => _saving = true);
                      await ref.read(serverUrlProvider.notifier).reset();
                      ref.invalidate(_adminUsersProvider);
                      if (!mounted) return;
                      nav.pop();
                    },
              child: const Padding(
                padding: EdgeInsets.symmetric(vertical: 6),
                child: Text(
                  'Reset to default',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
