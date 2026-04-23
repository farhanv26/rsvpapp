import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_client.dart';
import '../../core/services/auth_service.dart';
import '../../shared/theme/app_theme.dart';

final _adminUsersProvider = FutureProvider<List<String>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get<Map<String, dynamic>>('/auth/users');
    final list = res.data!['users'] as List<dynamic>;
    return list.cast<String>();
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
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_selectedUser == null) {
      setState(() => _error = 'Please select an account.');
      return;
    }
    if (_passwordCtrl.text.isEmpty) {
      setState(() => _error = 'Enter your password.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final authService = ref.read(authServiceProvider);
      final user = await authService.login(_selectedUser!, _passwordCtrl.text);
      await ref.read(currentUserProvider.notifier).login(user);
    } on ApiException catch (e) {
      setState(() => _error = e.isUnauthorized ? 'Incorrect password.' : e.message);
    } catch (_) {
      setState(() => _error = 'Connection failed. Check your network.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final usersAsync = ref.watch(_adminUsersProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 48),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 32),

              // Brand mark
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [AppColors.brandMid, Color(0xFF302216)],
                  ),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF302216).withValues(alpha: 0.35),
                      offset: const Offset(0, 8),
                      blurRadius: 20,
                      spreadRadius: -4,
                    ),
                  ],
                ),
                child: const Icon(Icons.event_note_rounded,
                    color: AppColors.textInverse, size: 28),
              ),

              const SizedBox(height: 28),

              const Text(
                'Admin',
                style: AppTextStyles.headlineDisplay,
              ),
              const SizedBox(height: 6),
              Text(
                'Sign in to manage your events.',
                style: AppTextStyles.bodyMedium
                    .copyWith(color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 44),

              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(
                        color: AppColors.danger.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded,
                          color: AppColors.danger, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(_error!,
                            style: const TextStyle(
                                color: AppColors.danger, fontSize: 14)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // Account selector
              usersAsync.when(
                loading: () => _dropdownShell(
                  child: const Row(
                    children: [
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.brandAccent),
                      ),
                      SizedBox(width: 12),
                      Text('Loading accounts…',
                          style: TextStyle(
                              color: AppColors.textMuted, fontSize: 15)),
                    ],
                  ),
                ),
                error: (_, __) => _dropdownShell(
                  child: const Row(
                    children: [
                      Icon(Icons.error_outline_rounded,
                          size: 18, color: AppColors.danger),
                      SizedBox(width: 10),
                      Text('Could not load accounts',
                          style: TextStyle(
                              color: AppColors.danger, fontSize: 14)),
                    ],
                  ),
                ),
                data: (users) => GestureDetector(
                  onTap: () => _showUserPicker(context, users),
                  child: _dropdownShell(
                    child: Row(
                      children: [
                        const Icon(Icons.person_outline_rounded,
                            size: 20, color: AppColors.textSecondary),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _selectedUser ?? 'Select account',
                            style: TextStyle(
                              fontSize: 15,
                              color: _selectedUser != null
                                  ? AppColors.textPrimary
                                  : AppColors.textMuted,
                            ),
                          ),
                        ),
                        const Icon(Icons.unfold_more_rounded,
                            size: 20, color: AppColors.textMuted),
                      ],
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 14),

              // Password field
              TextField(
                controller: _passwordCtrl,
                obscureText: _obscure,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _login(),
                decoration: InputDecoration(
                  labelText: 'Password',
                  prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                  suffixIcon: IconButton(
                    onPressed: () => setState(() => _obscure = !_obscure),
                    icon: Icon(
                      _obscure
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      size: 20,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 28),

              // Primary CTA — gradient button matching web .btn-primary
              GestureDetector(
                onTap: _loading ? null : _login,
                child: AnimatedOpacity(
                  opacity: _loading ? 0.65 : 1.0,
                  duration: const Duration(milliseconds: 150),
                  child: Container(
                    width: double.infinity,
                    height: 50,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [AppColors.brandMid, Color(0xFF302216)],
                      ),
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF302216).withValues(alpha: 0.35),
                          offset: const Offset(0, 8),
                          blurRadius: 24,
                          spreadRadius: -6,
                        ),
                      ],
                    ),
                    child: Center(
                      child: _loading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppColors.textInverse),
                            )
                          : const Text(
                              'Sign in',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textInverse,
                                letterSpacing: -0.2,
                              ),
                            ),
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

  Widget _dropdownShell({required Widget child}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: child,
    );
  }

  void _showUserPicker(BuildContext context, List<String> users) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const Text(
                'Select account',
                style: AppTextStyles.titleSmall,
              ),
              const SizedBox(height: 12),
              ...users.map((name) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: _selectedUser == name
                            ? AppColors.brandMid
                            : AppColors.brandAccentLight,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        Icons.person_rounded,
                        size: 18,
                        color: _selectedUser == name
                            ? AppColors.textInverse
                            : AppColors.brandAccent,
                      ),
                    ),
                    title: Text(name,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w500)),
                    trailing: _selectedUser == name
                        ? const Icon(Icons.check_circle_rounded,
                            color: AppColors.brandAccent)
                        : null,
                    onTap: () {
                      setState(() => _selectedUser = name);
                      Navigator.pop(ctx);
                    },
                  )),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}
