import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_client.dart';
import '../../core/services/auth_service.dart';
import '../../shared/theme/app_theme.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final username = _usernameCtrl.text.trim();
    final password = _passwordCtrl.text;
    if (username.isEmpty || password.isEmpty) {
      setState(() => _error = 'Enter your username and password.');
      return;
    }

    setState(() { _loading = true; _error = null; });
    try {
      final authService = ref.read(authServiceProvider);
      final user = await authService.login(username, password);
      await ref.read(currentUserProvider.notifier).login(user);
    } on ApiException catch (e) {
      setState(() => _error = e.isUnauthorized ? 'Invalid credentials.' : e.message);
    } catch (_) {
      setState(() => _error = 'Connection failed. Check your network.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 48),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 32),
              // Logo / branding
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.event_note_rounded, color: Colors.white, size: 28),
              ),
              const SizedBox(height: 28),
              const Text(
                'Admin',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.8),
              ),
              const SizedBox(height: 6),
              const Text(
                'Sign in to manage your events.',
                style: TextStyle(fontSize: 15, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 44),

              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded, color: AppColors.declined, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(_error!, style: const TextStyle(color: AppColors.declined, fontSize: 14)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              TextField(
                controller: _usernameCtrl,
                keyboardType: TextInputType.text,
                textInputAction: TextInputAction.next,
                autocorrect: false,
                decoration: const InputDecoration(labelText: 'Username', prefixIcon: Icon(Icons.person_outline_rounded, size: 20)),
              ),
              const SizedBox(height: 14),
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
                    icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 20),
                  ),
                ),
              ),
              const SizedBox(height: 28),
              ElevatedButton(
                onPressed: _loading ? null : _login,
                child: _loading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Sign in'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
