import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/api/api_client.dart';
import '../../core/models/event.dart';
import '../../core/models/event_sections.dart';
import '../../core/services/events_service.dart';
import '../../core/services/guests_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/utils/error_message.dart';
import '../../shared/utils/resolve_image_url.dart';
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

class _EventDetailScreenState extends ConsumerState<EventDetailScreen> {
  Timer? _loadingTimer;
  bool _showLoadTimeout = false;

  @override
  void initState() {
    super.initState();
    _startLoadingWatchdog();
  }

  @override
  void dispose() {
    _loadingTimer?.cancel();
    super.dispose();
  }

  void _startLoadingWatchdog() {
    _loadingTimer?.cancel();
    _showLoadTimeout = false;
    _loadingTimer = Timer(const Duration(seconds: 15), () {
      if (!mounted) return;
      setState(() => _showLoadTimeout = true);
    });
  }

  void _refresh() {
    setState(() => _showLoadTimeout = false);
    _startLoadingWatchdog();
    ref.invalidate(eventDetailProvider(widget.eventId));
    ref.invalidate(eventSectionsProvider(widget.eventId));
  }

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(eventDetailProvider(widget.eventId));

    detailAsync.whenOrNull(
      data: (_) => _loadingTimer?.cancel(),
      error: (_, __) => _loadingTimer?.cancel(),
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: detailAsync.maybeWhen(
          data: (d) => Text(
            d.event.displayName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.titleMedium,
          ),
          orElse: () => const Text('Event'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: _refresh,
          ),
        ],
      ),
      body: detailAsync.when(
        loading: () => _showLoadTimeout
            ? ErrorView(
                message: 'Loading is taking too long. Check your connection.',
                onRetry: _refresh,
              )
            : const Center(
                child: CircularProgressIndicator(color: AppColors.brandAccent, strokeWidth: 2),
              ),
        error: (e, _) => ErrorView(
          message: userFacingErrorMessage(e),
          onRetry: _refresh,
        ),
        data: (detail) => _EventDetailScrollView(
          eventId: widget.eventId,
          detail: detail,
          onRefresh: _refresh,
        ),
      ),
    );
  }
}

class _EventDetailScrollView extends ConsumerStatefulWidget {
  const _EventDetailScrollView({
    required this.eventId,
    required this.detail,
    required this.onRefresh,
  });

  final String eventId;
  final EventDetail detail;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_EventDetailScrollView> createState() => _EventDetailScrollViewState();
}

class _EventDetailScrollViewState extends ConsumerState<_EventDetailScrollView> {
  late final ScrollController _scroll;

  @override
  void initState() {
    super.initState();
    _scroll = ScrollController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      _scroll.jumpTo(0);
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ev = widget.detail.event;
    final s = widget.detail.stats;
    final baseUrl = ref.watch(apiClientProvider).baseUrl;
    final imageUrl = resolvePublicImageUrl(baseUrl, ev.imagePath);
    final sectionsAsync = ref.watch(eventSectionsProvider(widget.eventId));

    return RefreshIndicator(
      color: AppColors.brandAccent,
      backgroundColor: AppColors.surfaceCard,
      onRefresh: () async => widget.onRefresh(),
      child: CustomScrollView(
        controller: _scroll,
        primary: false,
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              child: _HeroInviteCard(imageUrl: imageUrl, eventName: ev.displayName),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (ev.eventSubtitle != null && ev.eventSubtitle!.isNotEmpty) ...[
                    Text(ev.eventSubtitle!, style: AppTextStyles.bodySmall),
                    const SizedBox(height: 12),
                  ],
                  _MetaRows(ev: ev),
                  const SizedBox(height: 20),
                  const Text('RSVP PROGRESS', style: AppTextStyles.sectionLabel),
                  const SizedBox(height: 8),
                  _RsvpProgressBar(rate: s.responseRate, responded: s.totalResponded, of: s.countedFamilies),
                  const SizedBox(height: 20),
                  const Text('QUICK STATS', style: AppTextStyles.sectionLabel),
                  const SizedBox(height: 10),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1.22,
              ),
              delegate: SliverChildListDelegate([
                StatCard(
                  label: 'Responded',
                  value: '${s.totalResponded}',
                  sub: '${s.responseRate}% rate',
                  progress: s.responseRate / 100,
                ),
                StatCard(
                  label: 'Attending',
                  value: '${s.attendingFamilies}',
                  color: AppColors.attending,
                  progress: s.totalFamilies > 0 ? s.attendingFamilies / s.totalFamilies : 0,
                ),
                StatCard(
                  label: 'Declined',
                  value: '${s.declinedFamilies}',
                  color: AppColors.declined,
                  progress: s.totalFamilies > 0 ? s.declinedFamilies / s.totalFamilies : 0,
                ),
                StatCard(
                  label: 'Confirmed',
                  value: '${s.confirmedAttendees}',
                  sub: 'guests',
                  color: AppColors.brandAccent,
                  progress: s.totalMaxInvited > 0
                      ? (s.confirmedAttendees / s.totalMaxInvited).clamp(0.0, 1.0)
                      : 0,
                ),
                StatCard(
                  label: 'Invited',
                  value: '${s.invitedFamilies}',
                  progress: s.totalFamilies > 0 ? s.invitedFamilies / s.totalFamilies : 0,
                ),
                StatCard(
                  label: 'Awaiting RSVP',
                  value: '${s.awaitingRsvpCount}',
                  color: AppColors.pending,
                  progress: s.invitedFamilies > 0
                      ? (s.awaitingRsvpCount / s.invitedFamilies).clamp(0.0, 1.0)
                      : 0,
                ),
              ]),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: _GuestSummaryCard(stats: s),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('QUICK ACTIONS', style: AppTextStyles.sectionLabel),
                  const SizedBox(height: 10),
                  _ActionTile(
                    icon: Icons.people_rounded,
                    label: 'Guest list',
                    sub: '${s.totalFamilies} families · manage RSVPs',
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => GuestsListScreen(eventId: widget.eventId, eventTitle: ev.displayName),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  _ActionTile(
                    icon: Icons.history_rounded,
                    label: 'Activity',
                    sub: 'Audit trail and recent actions',
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ActivityScreen(eventId: widget.eventId, eventTitle: ev.displayName),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: sectionsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(color: AppColors.brandAccent, strokeWidth: 2),
                  ),
                ),
              ),
              error: (_, __) => const SizedBox.shrink(),
              data: (sec) => Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                child: _SectionsColumn(sec: sec),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroInviteCard extends StatelessWidget {
  const _HeroInviteCard({required this.imageUrl, required this.eventName});
  final String? imageUrl;
  final String eventName;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.xl),
        boxShadow: AppShadows.cardLift,
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: AspectRatio(
        aspectRatio: 16 / 10,
        child: imageUrl != null
            ? Image.network(
                imageUrl!,
                fit: BoxFit.cover,
                alignment: Alignment.center,
                filterQuality: FilterQuality.medium,
                loadingBuilder: (_, child, progress) {
                  if (progress == null) return child;
                  return Container(
                    color: AppColors.surfaceMuted,
                    child: const Center(
                      child: SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandAccent),
                      ),
                    ),
                  );
                },
                errorBuilder: (_, __, ___) => _fallback(eventName),
              )
            : _fallback(eventName),
      ),
    );
  }

  Widget _fallback(String name) {
    return Container(
      color: AppColors.surfaceMuted,
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.photo_outlined, size: 36, color: AppColors.textMuted.withValues(alpha: 0.7)),
          const SizedBox(height: 10),
          Text(
            'No invite card image',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppColors.textMuted.withValues(alpha: 0.9)),
          ),
          const SizedBox(height: 4),
          Text(
            name,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _MetaRows extends StatelessWidget {
  const _MetaRows({required this.ev});
  final EventDetailInfo ev;

  @override
  Widget build(BuildContext context) {
    final rows = <(IconData, String)>[];
    if (ev.eventDate != null) {
      rows.add((
        Icons.calendar_today_outlined,
        '${DateFormat('EEE, d MMM yyyy').format(ev.eventDate!)}'
        '${ev.eventTime != null ? ' · ${ev.eventTime}' : ''}',
      ));
    }
    if (ev.venue != null && ev.venue!.isNotEmpty) rows.add((Icons.location_on_outlined, ev.venue!));
    if (ev.rsvpDeadline != null) {
      rows.add((Icons.schedule_rounded, 'RSVP by ${DateFormat('d MMM yyyy').format(ev.rsvpDeadline!)}'));
    }
    if (rows.isEmpty) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: rows
            .map(
              (r) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(r.$1, size: 16, color: AppColors.brandMid),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(r.$2, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.35)),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _RsvpProgressBar extends StatelessWidget {
  const _RsvpProgressBar({required this.rate, required this.responded, required this.of});
  final int rate;
  final int responded;
  final int of;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('$rate%', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  of > 0 ? '$responded of $of families responded' : 'No counted families yet',
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: of > 0 ? (rate / 100).clamp(0.0, 1.0) : 0,
              minHeight: 8,
              backgroundColor: AppColors.surfaceMuted,
              color: AppColors.brandAccent,
            ),
          ),
        ],
      ),
    );
  }
}

class _GuestSummaryCard extends StatelessWidget {
  const _GuestSummaryCard({required this.stats});
  final EventStats stats;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('GUEST SUMMARY', style: AppTextStyles.sectionLabel),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _MiniStat(label: 'Families', value: '${stats.totalFamilies}'),
              _MiniStat(label: 'Headcount', value: '${stats.totalMaxInvited}'),
              _MiniStat(label: 'Men', value: '${stats.totalMen}'),
              _MiniStat(label: 'Women', value: '${stats.totalWomen}'),
              _MiniStat(label: 'Kids', value: '${stats.totalKids}'),
              _MiniStat(label: 'Not invited', value: '${stats.notInvitedCount}'),
            ],
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.brandAccentLight,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 0.6)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.sub,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final String sub;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surfaceCard,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: AppColors.border),
            boxShadow: AppShadows.card,
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.brandAccentLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Icon(icon, color: AppColors.brandMid),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: AppTextStyles.titleSmall),
                    const SizedBox(height: 2),
                    Text(sub, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionsColumn extends StatelessWidget {
  const _SectionsColumn({required this.sec});
  final EventSections sec;

  @override
  Widget build(BuildContext context) {
    final dl = sec.rsvpDeadline;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (dl.status != 'none' && dl.status != 'open') ...[
          _DeadlineAlert(status: dl.status, deadline: dl.deadline),
          const SizedBox(height: 20),
        ],
        const Text('FOLLOW-UP', style: AppTextStyles.sectionLabel),
        const SizedBox(height: 10),
        _SectionCard(
          child: SectionStatRow(
            icon: Icons.hourglass_top_rounded,
            label: 'Invited, awaiting RSVP',
            value: '${sec.followUp.awaitingRsvp}',
            color: AppColors.pending,
          ),
        ),
        const SizedBox(height: 20),
        const Text('READINESS', style: AppTextStyles.sectionLabel),
        const SizedBox(height: 10),
        _SectionCard(
          child: Column(
            children: [
              SectionStatRow(icon: Icons.send_rounded, label: 'Ready to send', value: '${sec.readiness.readyToSend}', color: AppColors.success),
              const _Hairline(),
              SectionStatRow(icon: Icons.person_off_outlined, label: 'Missing contact', value: '${sec.readiness.missingContact}', color: AppColors.warning),
              const _Hairline(),
              SectionStatRow(icon: Icons.mark_email_read_outlined, label: 'Already invited', value: '${sec.readiness.alreadyInvited}', color: AppColors.invited),
              const _Hairline(),
              SectionStatRow(icon: Icons.check_circle_outline_rounded, label: 'Responded', value: '${sec.readiness.responded}', color: AppColors.attending),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text('LIST HYGIENE', style: AppTextStyles.sectionLabel),
        const SizedBox(height: 10),
        _SectionCard(
          child: Column(
            children: [
              SectionStatRow(
                icon: Icons.copy_all_rounded,
                label: 'Possible duplicates',
                value: '${sec.listHygiene.possibleDuplicates}',
                color: sec.listHygiene.possibleDuplicates > 0 ? AppColors.warning : AppColors.attending,
              ),
              const _Hairline(),
              SectionStatRow(
                icon: Icons.contact_phone_outlined,
                label: 'Missing contact',
                value: '${sec.listHygiene.missingContact}',
                color: sec.listHygiene.missingContact > 0 ? AppColors.warning : AppColors.attending,
              ),
              const _Hairline(),
              SectionStatRow(icon: Icons.check_rounded, label: 'Send-ready', value: '${sec.listHygiene.sendReady}', color: AppColors.attending),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text('COMMUNICATIONS', style: AppTextStyles.sectionLabel),
        const SizedBox(height: 10),
        _SectionCard(
          child: Column(
            children: [
              SectionStatRow(icon: Icons.history_rounded, label: 'Total logs', value: '${sec.communications.totalLogs}'),
              const _Hairline(),
              SectionStatRow(
                icon: Icons.trending_up_rounded,
                label: 'Last 7 days',
                value: '${sec.communications.recentLogs}',
                color: sec.communications.recentLogs > 0 ? AppColors.brandAccent : null,
              ),
              const _Hairline(),
              SectionStatRow(icon: Icons.people_outline_rounded, label: 'Guests with history', value: '${sec.communications.guestsWithLogs}', color: AppColors.attending),
            ],
          ),
        ),
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: child,
    );
  }
}

class _Hairline extends StatelessWidget {
  const _Hairline();
  @override
  Widget build(BuildContext context) => const Divider(height: 1, color: AppColors.borderLight);
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
        border: Border.all(color: fgColor.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: fgColor),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: fgColor)),
                if (deadline != null)
                  Text(
                    DateFormat('d MMM yyyy').format(deadline!),
                    style: TextStyle(fontSize: 12, color: fgColor.withValues(alpha: 0.85)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
