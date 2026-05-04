import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/models/event.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/events_service.dart';
import '../../core/services/notifications_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/empty_state.dart';
import '../notifications/notifications_screen.dart';
import 'create_event_screen.dart';
import 'event_detail_screen.dart';
import 'widgets/event_card.dart';

class EventsListScreen extends ConsumerWidget {
  const EventsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(eventsListProvider);
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: eventsAsync.when(
        loading: () => const _LoadingSkeleton(),
        error: (e, _) => _ErrorBody(
          message: e.toString().replaceFirst('ApiException', '').replaceAll(':', '').trim(),
          onRetry: () => ref.invalidate(eventsListProvider),
        ),
        data: (events) => _EventsBody(events: events, user: user, ref: ref),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await Navigator.push<bool>(
            context,
            MaterialPageRoute(builder: (_) => const CreateEventScreen()),
          );
          if (created == true) ref.invalidate(eventsListProvider);
        },
        backgroundColor: AppColors.brandAccent,
        foregroundColor: AppColors.textInverse,
        elevation: 0,
        icon: const Icon(Icons.add_rounded, size: 20),
        label: const Text('New Event', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      ),
    );
  }
}

// ── Main body ──────────────────────────────────────────────────────

class _EventsBody extends StatelessWidget {
  const _EventsBody({required this.events, required this.user, required this.ref});
  final List<Event> events;
  final dynamic user;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();

    if (events.isEmpty) {
      return SafeArea(
        child: Column(
          children: [
            _Header(user: user, now: now, ref: ref),
            const Expanded(
              child: EmptyState(
                icon: Icons.event_note_outlined,
                title: 'No events yet',
                subtitle: 'Tap "New Event" to create your first event.',
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.brandAccent,
      backgroundColor: AppColors.surfaceCard,
      onRefresh: () async => ref.invalidate(eventsListProvider),
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: SafeArea(child: _Header(user: user, now: now, ref: ref))),
          SliverToBoxAdapter(child: _SummaryHero(events: events)),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
            sliver: SliverList.separated(
              itemCount: events.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) => EventCard(
                event: events[i],
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => EventDetailScreen(eventId: events[i].id),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Header ─────────────────────────────────────────────────────────

class _Header extends ConsumerWidget {
  const _Header({required this.user, required this.now, required this.ref});
  final dynamic user;
  final DateTime now;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context, WidgetRef watchRef) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 8, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user != null ? 'Hi, ${user.name.split(' ').first}' : 'Events',
                  style: AppTextStyles.titleLarge,
                ),
                const SizedBox(height: 2),
                Text(
                  DateFormat('EEEE, d MMMM').format(now),
                  style: const TextStyle(fontSize: 13, color: AppColors.textMuted, fontWeight: FontWeight.w400),
                ),
              ],
            ),
          ),
          _NotificationIconButton(
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const NotificationsScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, size: 20),
            tooltip: 'Sign out',
            onPressed: () => _confirmLogout(context, ref),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You will be returned to the login screen.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
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

// ── Summary hero card ──────────────────────────────────────────────

class _SummaryHero extends StatelessWidget {
  const _SummaryHero({required this.events});
  final List<Event> events;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    int upcoming = 0, totalGuests = 0, todayCount = 0;
    for (final e in events) {
      totalGuests += e.guestCount;
      if (e.eventDate != null) {
        final d = DateTime(e.eventDate!.year, e.eventDate!.month, e.eventDate!.day);
        if (!d.isBefore(today)) upcoming++;
        if (d.isAtSameMomentAs(today)) todayCount++;
      }
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF2A1F10), Color(0xFF160F06)],
          ),
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: AppColors.brandAccent.withValues(alpha: 0.18)),
        ),
        child: Row(
          children: [
            _HeroStat(value: '${events.length}', label: 'Events', icon: Icons.event_rounded),
            _Divider(),
            _HeroStat(
              value: '$upcoming',
              label: 'Upcoming',
              icon: Icons.upcoming_rounded,
              accent: upcoming > 0,
            ),
            _Divider(),
            _HeroStat(value: '$totalGuests', label: 'Guests', icon: Icons.people_outline_rounded),
            if (todayCount > 0) ...[
              _Divider(),
              _HeroStat(
                value: '$todayCount',
                label: 'Today',
                icon: Icons.today_rounded,
                accent: true,
                accentColor: AppColors.danger,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({
    required this.value,
    required this.label,
    required this.icon,
    this.accent = false,
    this.accentColor,
  });
  final String value;
  final String label;
  final IconData icon;
  final bool accent;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final color = accent ? (accentColor ?? AppColors.brandAccent) : AppColors.textPrimary;
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 14, color: color.withValues(alpha: 0.6)),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: color, letterSpacing: -0.5, height: 1.0),
          ),
          const SizedBox(height: 4),
          Text(
            label.toUpperCase(),
            style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: AppColors.textMuted, letterSpacing: 0.8),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 36, color: AppColors.border);
  }
}

// ── Notification badge button ──────────────────────────────────────

class _NotificationIconButton extends ConsumerWidget {
  const _NotificationIconButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(notificationsProvider).valueOrNull?.unreadCount ?? 0;
    return Stack(
      alignment: Alignment.center,
      children: [
        IconButton(
          icon: const Icon(Icons.notifications_outlined),
          tooltip: 'Notifications',
          onPressed: onTap,
        ),
        if (unread > 0)
          Positioned(
            top: 10,
            right: 10,
            child: Container(
              width: 16,
              height: 16,
              decoration: const BoxDecoration(color: AppColors.danger, shape: BoxShape.circle),
              child: Center(
                child: Text(
                  unread > 9 ? '9+' : '$unread',
                  style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// ── Error body ─────────────────────────────────────────────────────

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          const SizedBox(height: 20),
          Expanded(child: ErrorView(message: message, onRetry: onRetry)),
        ],
      ),
    );
  }
}

// ── Skeleton loading ───────────────────────────────────────────────

class _LoadingSkeleton extends StatelessWidget {
  const _LoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 80, 16, 0),
        children: [
          const _ShimmerBox(height: 88, radius: AppRadius.lg),
          const SizedBox(height: 20),
          ...List.generate(
            4,
            (_) => const Padding(
              padding: EdgeInsets.only(bottom: 10),
              child: _SkeletonCard(),
            ),
          ),
        ],
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 86,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: const Row(
        children: [
          _ShimmerBox(width: 3, height: 50),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _ShimmerBox(height: 13, radius: 4, widthFraction: 0.60),
                SizedBox(height: 8),
                _ShimmerBox(height: 11, radius: 4, widthFraction: 0.40),
                SizedBox(height: 6),
                _ShimmerBox(height: 10, radius: 4, widthFraction: 0.30),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ShimmerBox extends StatefulWidget {
  const _ShimmerBox({this.width, this.height = 16, this.radius = 6, this.widthFraction});
  final double? width;
  final double height;
  final double radius;
  final double? widthFraction;

  @override
  State<_ShimmerBox> createState() => _ShimmerBoxState();
}

class _ShimmerBoxState extends State<_ShimmerBox> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000))..repeat(reverse: true);
    _anim = Tween<double>(begin: 0.3, end: 0.6).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final w = widget.widthFraction != null ? constraints.maxWidth * widget.widthFraction! : widget.width;
      return AnimatedBuilder(
        animation: _anim,
        builder: (_, __) => Container(
          width: w,
          height: widget.height,
          decoration: BoxDecoration(
            color: AppColors.surfaceHighlight.withValues(alpha: _anim.value + 0.3),
            borderRadius: BorderRadius.circular(widget.radius),
          ),
        ),
      );
    });
  }
}
