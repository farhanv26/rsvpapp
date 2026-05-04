import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/services/auth_service.dart';
import 'core/services/events_service.dart';
import 'features/auth/login_screen.dart';
import 'features/events/events_list_screen.dart';
import 'shared/theme/app_theme.dart';

class RsvpAdminApp extends StatelessWidget {
  const RsvpAdminApp({super.key});

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarBrightness: Brightness.dark,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppColors.background,
      systemNavigationBarIconBrightness: Brightness.light,
    ));
    return MaterialApp(
      title: 'RSVP Admin',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const _AuthGate(),
    );
  }
}

class _AuthGate extends ConsumerStatefulWidget {
  const _AuthGate();

  @override
  ConsumerState<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends ConsumerState<_AuthGate> {
  bool _booting = true;

  @override
  void initState() {
    super.initState();

    // Render the splash on the first frame BEFORE touching any platform
    // channels (keychain). If we call FlutterSecureStorage before the first
    // frame is painted the iOS keychain can block the engine thread and
    // freeze the spinner.
    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());

    // Absolute fallback — if everything hangs, show UI after 12 s.
    Future.delayed(const Duration(seconds: 12), () {
      if (mounted && _booting) setState(() => _booting = false);
    });
  }

  Future<void> _boot() async {
    try {
      await ref.read(currentUserProvider.notifier).loadFromStorage();
    } catch (_) {
      // loadFromStorage has its own internal timeouts; this catches anything
      // that somehow escapes them.
    }

    // Pre-warm events list so data is already in flight when the splash ends.
    if (mounted && ref.read(currentUserProvider) != null) {
      ref.read(eventsListProvider);
    }

    // Minimum splash duration.
    await Future.delayed(const Duration(milliseconds: 800));

    if (mounted) setState(() => _booting = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_booting) return const _SplashScreen();

    final user = ref.watch(currentUserProvider);
    return user == null ? const LoginScreen() : const EventsListScreen();
  }
}

// ── Splash screen ──────────────────────────────────────────────────

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(flex: 3),
            Center(
              child: Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.brandAccentBright, AppColors.brandAccent],
                  ),
                  borderRadius: BorderRadius.circular(26),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.brandAccent.withValues(alpha: 0.35),
                      offset: const Offset(0, 16),
                      blurRadius: 48,
                      spreadRadius: -8,
                    ),
                  ],
                ),
                child: const Icon(Icons.event_note_rounded, color: AppColors.textInverse, size: 40),
              ),
            ),
            const SizedBox(height: 28),
            const Text(
              'RSVP Admin',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.8,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Event Management',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w400,
                letterSpacing: 0.2,
                color: AppColors.textMuted,
              ),
            ),
            const Spacer(flex: 3),
            Padding(
              padding: const EdgeInsets.only(bottom: 52),
              child: Column(
                children: [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 1.5,
                      color: AppColors.brandAccent.withValues(alpha: 0.5),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Loading…',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w400,
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
