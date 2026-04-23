import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/services/auth_service.dart';
import 'features/auth/login_screen.dart';
import 'features/events/events_list_screen.dart';
import 'shared/theme/app_theme.dart';

class RsvpAdminApp extends ConsumerWidget {
  const RsvpAdminApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
  bool _bootstrapping = true;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await ref.read(currentUserProvider.notifier).loadFromStorage();
    if (mounted) setState(() => _bootstrapping = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_bootstrapping) {
      return const Scaffold(
        backgroundColor: AppColors.surface,
        body: Center(child: CircularProgressIndicator(color: AppColors.brandMid)),
      );
    }

    final user = ref.watch(currentUserProvider);
    if (user == null) return const LoginScreen();
    return const EventsListScreen();
  }
}
