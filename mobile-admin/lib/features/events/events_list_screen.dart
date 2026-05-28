import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/models/event.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/events_service.dart';
import '../../core/services/notifications_service.dart';
import '../../shared/navigation/adaptive_page_route.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/utils/error_message.dart';
import '../../shared/widgets/empty_state.dart';
import 'create_event_screen.dart';
import 'event_detail_screen.dart';
import 'widgets/event_card.dart';

class EventsListScreen extends ConsumerWidget {
  const EventsListScreen({super.key, this.onNotificationsTap});

  final VoidCallback? onNotificationsTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(eventsListProvider);
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: eventsAsync.when(
        loading: () => const _LoadingSkeleton(),
        error: (e, _) => SafeArea(
          child: Column(
            children: [
              _Header(user: user, onNotificationsTap: onNotificationsTap),
              Expanded(
                child: ErrorView(
                  message: userFacingErrorMessage(e),
                  onRetry: () => ref.invalidate(eventsListProvider),
                ),
              ),
            ],
          ),
        ),
        data: (events) => _EventsBody(
          events: events,
          user: user,
          onNotificationsTap: onNotificationsTap,
        ),
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
        foregroundColor: AppColors.textOnAccent,
        elevation: 0,
        icon: const Icon(Icons.add_rounded, size: 20),
        label: const Text('New Event', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.pill)),
      ),
    );
  }
}

// ── Main body ──────────────────────────────────────────────────────

class _EventsBody extends ConsumerWidget {
  const _EventsBody({
    required this.events,
    required this.user,
    this.onNotificationsTap,
  });
  final List<Event> events;
  final dynamic user;
  final VoidCallback? onNotificationsTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();

    if (events.isEmpty) {
      return SafeArea(
        child: Column(
          children: [
            _Header(user: user, onNotificationsTap: onNotificationsTap),
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
          SliverToBoxAdapter(
            child: SafeArea(
              child: _Header(user: user, now: now, onNotificationsTap: onNotificationsTap),
            ),
          ),
          SliverToBoxAdapter(child: _SummaryStrip(events: events)),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 120),
            sliver: SliverList.separated(
              itemCount: events.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) => EventCard(
                event: events[i],
                onTap: () => Navigator.push(
                  context,
                  adaptivePushRoute(EventDetailScreen(eventId: events[i].id)),
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
  const _Header({required this.user, this.now, this.onNotificationsTap});
  final dynamic user;
  final DateTime? now;
  final VoidCallback? onNotificationsTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final date = now ?? DateTime.now();
    final unread = ref.watch(notificationsProvider).valueOrNull?.unreadCount ?? 0;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 12, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user != null ? 'Hi, ${(user.name as String).split(' ').first}' : 'Events',
                  style: AppTextStyles.titleLarge,
                ),
                const SizedBox(height: 2),
                Text(
                  DateFormat('EEEE, d MMMM').format(date),
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
          if (onNotificationsTap != null)
            Stack(
              alignment: Alignment.center,
              children: [
                IconButton(
                  icon: const Icon(Icons.notifications_outlined, size: 22),
                  color: AppColors.textSecondary,
                  tooltip: 'Notifications',
                  onPressed: onNotificationsTap,
                ),
                if (unread > 0)
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Container(
                      width: 16,
                      height: 16,
                      decoration: const BoxDecoration(
                        color: AppColors.declined,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          unread > 9 ? '9+' : '$unread',
                          style: const TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

// ── Summary strip ──────────────────────────────────────────────────

class _SummaryStrip extends StatelessWidget {
  const _SummaryStrip({required this.events});
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
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Row(
        children: [
          Expanded(child: _StatPill(value: '${events.length}', label: 'Total', icon: Icons.event_rounded)),
          const SizedBox(width: 10),
          Expanded(
            child: _StatPill(
              value: '$upcoming',
              label: 'Upcoming',
              icon: Icons.upcoming_rounded,
              highlight: upcoming > 0,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(child: _StatPill(value: '$totalGuests', label: 'Guests', icon: Icons.people_outline_rounded)),
          if (todayCount > 0) ...[
            const SizedBox(width: 10),
            Expanded(
              child: _StatPill(
                value: '$todayCount',
                label: 'Today',
                icon: Icons.today_rounded,
                highlight: true,
                dangerHighlight: true,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  const _StatPill({
    required this.value,
    required this.label,
    required this.icon,
    this.highlight = false,
    this.dangerHighlight = false,
  });
  final String value;
  final String label;
  final IconData icon;
  final bool highlight;
  final bool dangerHighlight;

  @override
  Widget build(BuildContext context) {
    final Color accent = dangerHighlight
        ? AppColors.declined
        : highlight
            ? AppColors.brandAccent
            : AppColors.textSecondary;
    final Color bg = dangerHighlight
        ? AppColors.declinedBg
        : highlight
            ? AppColors.brandAccentLight
            : AppColors.surfaceMuted;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: (dangerHighlight
                  ? AppColors.declined
                  : highlight
                      ? AppColors.brandAccent
                      : AppColors.border)
              .withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(icon, size: 14, color: accent.withValues(alpha: 0.7)),
          const SizedBox(height: 5),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: accent,
              letterSpacing: -0.3,
              height: 1.0,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 8,
              fontWeight: FontWeight.w700,
              color: accent.withValues(alpha: 0.65),
              letterSpacing: 0.6,
            ),
          ),
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
          const _ShimmerRow(4),
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

class _ShimmerRow extends StatelessWidget {
  const _ShimmerRow(this.count);
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(
        count,
        (i) => Expanded(
          child: Padding(
            padding: EdgeInsets.only(left: i == 0 ? 0 : 10),
            child: const _ShimmerBox(height: 70, radius: AppRadius.md),
          ),
        ),
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
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))
      ..repeat(reverse: true);
    _anim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
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
            color: Color.lerp(AppColors.surfaceMuted, AppColors.surfaceHighlight, _anim.value),
            borderRadius: BorderRadius.circular(widget.radius),
          ),
        ),
      );
    });
  }
}
