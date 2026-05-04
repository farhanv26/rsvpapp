import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/services/events_service.dart';
import '../../core/services/guests_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/empty_state.dart';
import '../guests/guests_list_screen.dart';
import 'activity_screen.dart';
import 'widgets/stat_card.dart';

class EventDetailScreen extends ConsumerStatefulWidget {
  const EventDetailScreen({super.key, required this.eventId});
  final String eventId;

  @override
  ConsumerState<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends ConsumerState<EventDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  void _refresh() {
    ref.invalidate(eventDetailProvider(widget.eventId));
    ref.invalidate(eventSectionsProvider(widget.eventId));
  }

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(eventDetailProvider(widget.eventId));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: detailAsync.when(
        loading: () => const _LoadingView(),
        error: (e, _) => _ErrorView(
          message: e.toString().replaceFirst('ApiException', '').replaceAll(':', '').trim(),
          onRetry: _refresh,
        ),
        data: (detail) => _DetailBody(
          eventId: widget.eventId,
          detail: detail,
          tabs: _tabs,
          onRefresh: _refresh,
        ),
      ),
    );
  }
}

// ── Body with nested scroll + pinned tabs ──────────────────────────

class _DetailBody extends StatelessWidget {
  const _DetailBody({
    required this.eventId,
    required this.detail,
    required this.tabs,
    required this.onRefresh,
  });
  final String eventId;
  final dynamic detail;
  final TabController tabs;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final ev = detail.event;

    return NestedScrollView(
      headerSliverBuilder: (context, _) => [
        // SliverAppBar with event title
        SliverAppBar(
          backgroundColor: AppColors.background,
          surfaceTintColor: Colors.transparent,
          pinned: true,
          expandedHeight: ev.imagePath != null && ev.imagePath!.isNotEmpty ? 200 : 0,
          flexibleSpace: ev.imagePath != null && ev.imagePath!.isNotEmpty
              ? FlexibleSpaceBar(
                  background: _HeroBanner(imagePath: ev.imagePath!, eventName: ev.displayName),
                  collapseMode: CollapseMode.parallax,
                )
              : null,
          title: Text(ev.displayName, style: AppTextStyles.titleMedium),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: onRefresh,
            ),
          ],
        ),

        // Quick info bar
        SliverToBoxAdapter(child: _EventInfoBar(ev: ev)),

        // Tab bar
        SliverPersistentHeader(
          pinned: true,
          delegate: _TabBarDelegate(
            TabBar(
              controller: tabs,
              indicatorColor: AppColors.brandAccent,
              indicatorWeight: 2,
              labelColor: AppColors.brandAccent,
              unselectedLabelColor: AppColors.textMuted,
              labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: -0.1),
              unselectedLabelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
              dividerColor: AppColors.border,
              tabs: const [
                Tab(text: 'Overview'),
                Tab(text: 'Guests'),
                Tab(text: 'Activity'),
              ],
            ),
          ),
        ),
      ],
      body: TabBarView(
        controller: tabs,
        children: [
          _OverviewTab(eventId: eventId, detail: detail),
          _GuestsTab(eventId: eventId, eventTitle: ev.displayName),
          _ActivityTab(eventId: eventId, eventTitle: ev.displayName),
        ],
      ),
    );
  }
}

// ── Hero banner ────────────────────────────────────────────────────

class _HeroBanner extends StatelessWidget {
  const _HeroBanner({required this.imagePath, required this.eventName});
  final String imagePath;
  final String eventName;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _openFullscreen(context),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.network(
            imagePath,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(color: AppColors.surfaceCard),
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x00000000), Color(0xCC0B0908)],
                stops: [0.4, 1.0],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openFullscreen(BuildContext context) {
    Navigator.of(context).push(PageRouteBuilder(
      opaque: false,
      barrierColor: Colors.black87,
      barrierDismissible: true,
      pageBuilder: (_, __, ___) => GestureDetector(
        onTap: () => Navigator.pop(context),
        child: Scaffold(
          backgroundColor: Colors.transparent,
          body: Center(
            child: InteractiveViewer(
              child: Image.network(imagePath, fit: BoxFit.contain),
            ),
          ),
        ),
      ),
      transitionsBuilder: (_, anim, __, child) => FadeTransition(opacity: anim, child: child),
    ));
  }
}

// ── Event info bar ─────────────────────────────────────────────────

class _EventInfoBar extends StatelessWidget {
  const _EventInfoBar({required this.ev});
  final dynamic ev;

  @override
  Widget build(BuildContext context) {
    final infos = <(IconData, String)>[];
    if (ev.eventDate != null) {
      infos.add((
        Icons.calendar_today_outlined,
        '${DateFormat('EEE, d MMM yyyy').format(ev.eventDate!)}'
        '${ev.eventTime != null ? '  ·  ${ev.eventTime}' : ''}',
      ));
    }
    if (ev.venue != null) infos.add((Icons.location_on_outlined, ev.venue!));
    if (ev.rsvpDeadline != null) {
      infos.add((Icons.access_time_rounded, 'RSVP by ${DateFormat('d MMM yyyy').format(ev.rsvpDeadline!)}'));
    }
    if (infos.isEmpty) return const SizedBox.shrink();

    return Container(
      color: AppColors.background,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: infos.map((pair) => Padding(
          padding: const EdgeInsets.only(bottom: 5),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(pair.$1, size: 13, color: AppColors.textMuted),
              const SizedBox(width: 8),
              Expanded(
                child: Text(pair.$2, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
              ),
            ],
          ),
        )).toList(),
      ),
    );
  }
}

// ── Overview tab ───────────────────────────────────────────────────

class _OverviewTab extends ConsumerWidget {
  const _OverviewTab({required this.eventId, required this.detail});
  final String eventId;
  final dynamic detail;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = detail.stats;
    final sectionsAsync = ref.watch(eventSectionsProvider(eventId));

    return RefreshIndicator(
      color: AppColors.brandAccent,
      backgroundColor: AppColors.surfaceCard,
      onRefresh: () async {
        ref.invalidate(eventDetailProvider(eventId));
        ref.invalidate(eventSectionsProvider(eventId));
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
        children: [
          // Deadline alert
          sectionsAsync.maybeWhen(
            data: (sec) {
              final dl = sec.rsvpDeadline;
              if (dl.status == 'none' || dl.status == 'open') return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _DeadlineAlert(status: dl.status, deadline: dl.deadline),
              );
            },
            orElse: () => const SizedBox.shrink(),
          ),

          // Stats grid
          const _SectionLabel('Overview'),
          const SizedBox(height: 10),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.25,
            children: [
              StatCard(
                label: 'Responded',
                value: '${s.totalResponded}',
                sub: '${s.responseRate}% response rate',
                progress: s.responseRate / 100,
              ),
              StatCard(
                label: 'Attending',
                value: '${s.attendingFamilies}',
                color: AppColors.attending,
                progress: s.totalFamilies > 0 ? s.attendingFamilies / s.totalFamilies : 0.0,
              ),
              StatCard(
                label: 'Declined',
                value: '${s.declinedFamilies}',
                color: AppColors.declined,
                progress: s.totalFamilies > 0 ? s.declinedFamilies / s.totalFamilies : 0.0,
              ),
              StatCard(
                label: 'Confirmed',
                value: '${s.confirmedAttendees}',
                sub: 'total attendees',
                color: AppColors.brandAccent,
                progress: s.totalMaxInvited > 0
                    ? (s.confirmedAttendees / s.totalMaxInvited).clamp(0.0, 1.0)
                    : 0.0,
              ),
              StatCard(
                label: 'Invited',
                value: '${s.invitedFamilies}',
                progress: s.totalFamilies > 0 ? s.invitedFamilies / s.totalFamilies : 0.0,
              ),
              StatCard(
                label: 'Awaiting RSVP',
                value: '${s.awaitingRsvpCount}',
                color: AppColors.pending,
                progress: s.invitedFamilies > 0
                    ? (s.awaitingRsvpCount / s.invitedFamilies).clamp(0.0, 1.0)
                    : 0.0,
              ),
            ],
          ),

          const SizedBox(height: 24),
          const _SectionLabel('Breakdown'),
          const SizedBox(height: 10),
          _DarkCard(
            child: Column(
              children: [
                StatRow(label: 'Total families', value: '${s.totalFamilies}'),
                const _Divider(),
                StatRow(label: 'Counted in totals', value: '${s.countedFamilies}'),
                const _Divider(),
                StatRow(label: 'Max capacity', value: '${s.totalMaxInvited}'),
                const _Divider(),
                StatRow(label: 'Men', value: '${s.totalMen}'),
                const _Divider(),
                StatRow(label: 'Women', value: '${s.totalWomen}'),
                const _Divider(),
                StatRow(label: 'Kids', value: '${s.totalKids}'),
                const _Divider(),
                StatRow(label: 'Not yet invited', value: '${s.notInvitedCount}'),
                const _Divider(),
                StatRow(label: 'Pending response', value: '${s.totalPending}'),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Sections from API
          sectionsAsync.when(
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(color: AppColors.brandAccent, strokeWidth: 2),
              ),
            ),
            error: (_, __) => const SizedBox.shrink(),
            data: (sec) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionLabel('Follow-up'),
                const SizedBox(height: 10),
                _DarkCard(
                  child: SectionStatRow(
                    icon: Icons.hourglass_top_rounded,
                    label: 'Invited, awaiting RSVP',
                    value: '${sec.followUp.awaitingRsvp}',
                    color: AppColors.pending,
                  ),
                ),
                const SizedBox(height: 24),

                const _SectionLabel('Readiness'),
                const SizedBox(height: 10),
                _DarkCard(
                  child: Column(children: [
                    SectionStatRow(icon: Icons.send_rounded, label: 'Ready to send', value: '${sec.readiness.readyToSend}', color: AppColors.success),
                    const _Divider(),
                    SectionStatRow(icon: Icons.person_off_outlined, label: 'Missing contact info', value: '${sec.readiness.missingContact}', color: AppColors.warning),
                    const _Divider(),
                    SectionStatRow(icon: Icons.mark_email_read_outlined, label: 'Already invited', value: '${sec.readiness.alreadyInvited}', color: AppColors.invited),
                    const _Divider(),
                    SectionStatRow(icon: Icons.check_circle_outline_rounded, label: 'Responded', value: '${sec.readiness.responded}', color: AppColors.attending),
                  ]),
                ),
                const SizedBox(height: 24),

                const _SectionLabel('List Hygiene'),
                const SizedBox(height: 10),
                _DarkCard(
                  child: Column(children: [
                    SectionStatRow(
                      icon: Icons.copy_all_rounded,
                      label: 'Possible duplicates',
                      value: '${sec.listHygiene.possibleDuplicates}',
                      color: sec.listHygiene.possibleDuplicates > 0 ? AppColors.warning : AppColors.attending,
                    ),
                    const _Divider(),
                    SectionStatRow(
                      icon: Icons.contact_phone_outlined,
                      label: 'Missing contact',
                      value: '${sec.listHygiene.missingContact}',
                      color: sec.listHygiene.missingContact > 0 ? AppColors.warning : AppColors.attending,
                    ),
                    const _Divider(),
                    SectionStatRow(icon: Icons.check_rounded, label: 'Send-ready guests', value: '${sec.listHygiene.sendReady}', color: AppColors.attending),
                  ]),
                ),
                const SizedBox(height: 24),

                const _SectionLabel('Communications'),
                const SizedBox(height: 10),
                _DarkCard(
                  child: Column(children: [
                    SectionStatRow(icon: Icons.history_rounded, label: 'Total logs recorded', value: '${sec.communications.totalLogs}'),
                    const _Divider(),
                    SectionStatRow(
                      icon: Icons.trending_up_rounded,
                      label: 'Actions in last 7 days',
                      value: '${sec.communications.recentLogs}',
                      color: sec.communications.recentLogs > 0 ? AppColors.brandAccent : null,
                    ),
                    const _Divider(),
                    SectionStatRow(icon: Icons.people_outline_rounded, label: 'Guests with history', value: '${sec.communications.guestsWithLogs}', color: AppColors.attending),
                  ]),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Guests tab ─────────────────────────────────────────────────────

class _GuestsTab extends StatelessWidget {
  const _GuestsTab({required this.eventId, required this.eventTitle});
  final String eventId;
  final String eventTitle;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 80),
      children: [
        GestureDetector(
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => GuestsListScreen(eventId: eventId, eventTitle: eventTitle),
            ),
          ),
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF2A1F10), Color(0xFF160F06)],
              ),
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: AppColors.brandAccent.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.brandAccent.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.people_rounded, color: AppColors.brandAccent, size: 22),
                ),
                const SizedBox(width: 16),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Guest List', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                      SizedBox(height: 2),
                      Text('View, search, filter & manage guests', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        const _QuickTip(
          icon: Icons.search_rounded,
          text: 'Search by name, phone, or email in the guest list.',
        ),
        const SizedBox(height: 8),
        const _QuickTip(
          icon: Icons.tune_rounded,
          text: 'Filter by status, readiness, or sort to find anyone instantly.',
        ),
        const SizedBox(height: 8),
        const _QuickTip(
          icon: Icons.person_add_outlined,
          text: 'Add new guests directly from the guest list screen.',
        ),
      ],
    );
  }
}

class _QuickTip extends StatelessWidget {
  const _QuickTip({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.textMuted),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4))),
        ],
      ),
    );
  }
}

// ── Activity tab ───────────────────────────────────────────────────

class _ActivityTab extends StatelessWidget {
  const _ActivityTab({required this.eventId, required this.eventTitle});
  final String eventId;
  final String eventTitle;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 80),
      children: [
        GestureDetector(
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ActivityScreen(eventId: eventId, eventTitle: eventTitle),
            ),
          ),
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppColors.surfaceCard,
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.brandAccent.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.history_rounded, color: AppColors.brandAccent, size: 20),
                ),
                const SizedBox(width: 16),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Activity Feed', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                      SizedBox(height: 2),
                      Text('View recent changes and actions', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ── Shared helpers ─────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(text.toUpperCase(), style: AppTextStyles.sectionLabel);
}

class _DarkCard extends StatelessWidget {
  const _DarkCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: child,
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    return const Divider(height: 1, color: AppColors.borderLight);
  }
}

class _DeadlineAlert extends StatelessWidget {
  const _DeadlineAlert({required this.status, this.deadline});
  final String status;
  final DateTime? deadline;

  @override
  Widget build(BuildContext context) {
    final isUrgent = status == 'closes_today' || status == 'closed';
    final fgColor = isUrgent ? AppColors.danger : AppColors.warning;
    final bgColor = isUrgent ? AppColors.dangerBg : AppColors.warningBg;
    final icon = status == 'closed' ? Icons.lock_clock_rounded : Icons.timer_outlined;
    final label = switch (status) {
      'closed' => 'RSVP closed',
      'closes_today' => 'RSVP closes today',
      'closing_soon' => 'RSVP closing soon',
      _ => 'RSVP deadline',
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: fgColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: fgColor),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: fgColor)),
                if (deadline != null)
                  Text(DateFormat('d MMM yyyy').format(deadline!),
                      style: TextStyle(fontSize: 12, color: fgColor.withValues(alpha: 0.7))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LoadingView extends StatelessWidget {
  const _LoadingView();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppColors.background,
      body: Center(child: CircularProgressIndicator(color: AppColors.brandAccent)),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(backgroundColor: AppColors.background),
      body: ErrorView(message: message, onRetry: onRetry),
    );
  }
}

// ── Pinned tab bar delegate ────────────────────────────────────────

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  const _TabBarDelegate(this.tabBar);
  final TabBar tabBar;

  @override
  double get minExtent => tabBar.preferredSize.height + 1;
  @override
  double get maxExtent => tabBar.preferredSize.height + 1;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: AppColors.background,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_TabBarDelegate oldDelegate) => tabBar != oldDelegate.tabBar;
}
