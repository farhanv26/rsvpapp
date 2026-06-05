import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
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
import 'edit_event_screen.dart';
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
    _startWatchdog();
  }

  @override
  void dispose() {
    _loadingTimer?.cancel();
    super.dispose();
  }

  void _startWatchdog() {
    _loadingTimer?.cancel();
    _showLoadTimeout = false;
    _loadingTimer = Timer(const Duration(seconds: 15), () {
      if (!mounted) return;
      setState(() => _showLoadTimeout = true);
    });
  }

  void _refresh() {
    setState(() => _showLoadTimeout = false);
    _startWatchdog();
    ref.invalidate(eventDetailProvider(widget.eventId));
    ref.invalidate(eventSectionsProvider(widget.eventId));
  }

  Future<void> _openEdit(BuildContext context, EventDetailInfo ev) async {
    final updated = await Navigator.push<EventDetailInfo>(
      context,
      MaterialPageRoute(builder: (_) => EditEventScreen(event: ev)),
    );
    if (updated != null) _refresh();
  }

  Future<void> _confirmDelete(BuildContext context, EventDetailInfo ev) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete event?'),
        content: Text('Are you sure you want to delete "${ev.displayName}"? This cannot be undone from the mobile app.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    try {
      await ref.read(eventsServiceProvider).deleteEvent(widget.eventId);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Event deleted')),
        );
        Navigator.pop(context, 'deleted');
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(userFacingErrorMessage(e))),
        );
      }
    }
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
        backgroundColor: AppColors.background,
        elevation: 0,
        title: detailAsync.maybeWhen(
          data: (d) => Text(
            d.event.displayName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.displaySerif.copyWith(fontSize: 17),
          ),
          orElse: () => const Text('Event', style: AppTextStyles.titleMedium),
        ),
        actions: [
          detailAsync.maybeWhen(
            data: (d) => IconButton(
              icon: const Icon(Icons.edit_outlined, size: 20),
              tooltip: 'Edit event',
              onPressed: () => _openEdit(context, d.event),
            ),
            orElse: () => const SizedBox.shrink(),
          ),
          detailAsync.maybeWhen(
            data: (d) => PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert_rounded, size: 20),
              color: AppColors.surfaceElevated,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
                side: const BorderSide(color: AppColors.border),
              ),
              itemBuilder: (_) => [
                const PopupMenuItem(
                  value: 'delete',
                  child: Row(
                    children: [
                      Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.danger),
                      SizedBox(width: 12),
                      Text('Delete event', style: TextStyle(fontSize: 14, color: AppColors.danger)),
                    ],
                  ),
                ),
              ],
              onSelected: (v) { if (v == 'delete') _confirmDelete(context, d.event); },
            ),
            orElse: () => const SizedBox.shrink(),
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
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
        data: (detail) => _EventDetailBody(
          eventId: widget.eventId,
          detail: detail,
          onRefresh: _refresh,
        ),
      ),
    );
  }
}

// ── Scrollable detail body ─────────────────────────────────────────

class _EventDetailBody extends ConsumerWidget {
  const _EventDetailBody({
    required this.eventId,
    required this.detail,
    required this.onRefresh,
  });
  final String eventId;
  final EventDetail detail;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ev = detail.event;
    final s = detail.stats;
    final baseUrl = ref.watch(apiClientProvider).baseUrl;
    final imageUrl = resolvePublicImageUrl(baseUrl, ev.imagePath);
    final sectionsAsync = ref.watch(eventSectionsProvider(eventId));

    return RefreshIndicator(
      color: AppColors.brandAccent,
      backgroundColor: AppColors.surfaceCard,
      onRefresh: () async => onRefresh(),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        slivers: [
          // Hero image
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              child: _HeroCard(imageUrl: imageUrl, eventName: ev.displayName),
            ),
          ),

          // Meta info
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
                  _MetaCard(ev: ev),
                  const SizedBox(height: 16),
                  _RsvpProgress(rate: s.responseRate, responded: s.totalResponded, of: s.countedFamilies),
                  const SizedBox(height: 20),
                  const Text('STATS', style: AppTextStyles.sectionLabel),
                  const SizedBox(height: 10),
                ],
              ),
            ),
          ),

          // Stats grid
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
                childAspectRatio: 1.1,
              ),
              delegate: SliverChildListDelegate([
                StatCard(
                  label: 'Responded',
                  value: '${s.totalResponded}',
                  sub: '${s.responseRate}% rate',
                  color: AppColors.responded,
                  colorBg: AppColors.respondedBg,
                  progress: s.responseRate / 100,
                  onTap: s.totalResponded > 0
                      ? () => Navigator.push(context, MaterialPageRoute(
                            builder: (_) => GuestsListScreen(
                              eventId: eventId,
                              eventTitle: ev.displayName,
                              initialReadiness: 'responded',
                            ),
                          ))
                      : null,
                ),
                StatCard(
                  label: 'Attending',
                  value: '${s.attendingFamilies}',
                  color: AppColors.attending,
                  colorBg: AppColors.attendingBg,
                  progress: s.totalFamilies > 0 ? s.attendingFamilies / s.totalFamilies : 0,
                  onTap: s.attendingFamilies > 0
                      ? () => Navigator.push(context, MaterialPageRoute(
                            builder: (_) => GuestsListScreen(
                              eventId: eventId,
                              eventTitle: ev.displayName,
                              initialStatusFilter: 'attending',
                            ),
                          ))
                      : null,
                ),
                StatCard(
                  label: 'Declined',
                  value: '${s.declinedFamilies}',
                  color: AppColors.declined,
                  colorBg: AppColors.declinedBg,
                  progress: s.totalFamilies > 0 ? s.declinedFamilies / s.totalFamilies : 0,
                  onTap: s.declinedFamilies > 0
                      ? () => Navigator.push(context, MaterialPageRoute(
                            builder: (_) => GuestsListScreen(
                              eventId: eventId,
                              eventTitle: ev.displayName,
                              initialStatusFilter: 'declined',
                            ),
                          ))
                      : null,
                ),
                StatCard(
                  label: 'Confirmed',
                  value: '${s.confirmedAttendees}',
                  sub: 'headcount',
                  color: AppColors.brandAccent,
                  colorBg: AppColors.confirmedBg,
                  progress: s.totalMaxInvited > 0
                      ? (s.confirmedAttendees / s.totalMaxInvited).clamp(0.0, 1.0)
                      : 0,
                  onTap: s.attendingFamilies > 0
                      ? () => Navigator.push(context, MaterialPageRoute(
                            builder: (_) => GuestsListScreen(
                              eventId: eventId,
                              eventTitle: ev.displayName,
                              initialStatusFilter: 'attending',
                            ),
                          ))
                      : null,
                ),
                StatCard(
                  label: 'Invited',
                  value: '${s.invitedFamilies}',
                  color: AppColors.invited,
                  colorBg: AppColors.invitedBg,
                  progress: s.totalFamilies > 0 ? s.invitedFamilies / s.totalFamilies : 0,
                  onTap: s.invitedFamilies > 0
                      ? () => Navigator.push(context, MaterialPageRoute(
                            builder: (_) => GuestsListScreen(
                              eventId: eventId,
                              eventTitle: ev.displayName,
                              initialReadiness: 'already_invited',
                            ),
                          ))
                      : null,
                ),
                StatCard(
                  label: 'Awaiting',
                  value: '${s.awaitingRsvpCount}',
                  color: AppColors.pending,
                  colorBg: AppColors.pendingBg,
                  progress: s.invitedFamilies > 0
                      ? (s.awaitingRsvpCount / s.invitedFamilies).clamp(0.0, 1.0)
                      : 0,
                  onTap: s.awaitingRsvpCount > 0
                      ? () => Navigator.push(context, MaterialPageRoute(
                            builder: (_) => GuestsListScreen(
                              eventId: eventId,
                              eventTitle: ev.displayName,
                              initialStatusFilter: 'pending',
                            ),
                          ))
                      : null,
                ),
              ]),
            ),
          ),

          // Guest summary
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: _GuestSummary(stats: s),
            ),
          ),

          // Quick actions
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('MANAGE', style: AppTextStyles.sectionLabel),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _QuickAction(
                          icon: Icons.people_rounded,
                          label: 'Guests',
                          sub: '${s.totalFamilies} families',
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => GuestsListScreen(eventId: eventId, eventTitle: ev.displayName),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _QuickAction(
                          icon: Icons.history_rounded,
                          label: 'Activity',
                          sub: 'Audit trail',
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ActivityScreen(eventId: eventId, eventTitle: ev.displayName),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _PreviewRsvpButton(eventId: eventId),
                ],
              ),
            ),
          ),

            // Itinerary
          if (ev.itinerary.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: _ItinerarySection(items: ev.itinerary),
              ),
            ),

          // Sections
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
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                child: _SectionsColumn(sec: sec, eventId: eventId, eventTitle: ev.displayName),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Preview RSVP button ────────────────────────────────────────────

class _PreviewRsvpButton extends ConsumerStatefulWidget {
  const _PreviewRsvpButton({required this.eventId});
  final String eventId;

  @override
  ConsumerState<_PreviewRsvpButton> createState() => _PreviewRsvpButtonState();
}

class _PreviewRsvpButtonState extends ConsumerState<_PreviewRsvpButton> {
  bool _loading = false;

  Future<void> _open() async {
    if (_loading) return;
    setState(() => _loading = true);
    try {
      final url = await ref.read(eventsServiceProvider).getPreviewUrl(widget.eventId);
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(userFacingErrorMessage(e)),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _loading ? null : _open,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: AppColors.border),
          color: AppColors.surfaceCard,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (_loading)
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 1.8, color: AppColors.brandAccent),
              )
            else
              const Icon(Icons.visibility_outlined, size: 18, color: AppColors.textSecondary),
            const SizedBox(width: 8),
            Text(
              _loading ? 'Opening preview…' : 'Preview RSVP',
              style: AppTextStyles.bodySmall.copyWith(
                fontWeight: FontWeight.w600,
                color: _loading ? AppColors.textSecondary : AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Hero card ──────────────────────────────────────────────────────

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.imageUrl, required this.eventName});
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
        aspectRatio: 16 / 9,
        child: imageUrl != null
            ? Image.network(
                imageUrl!,
                fit: BoxFit.cover,
                filterQuality: FilterQuality.medium,
                loadingBuilder: (_, child, progress) => progress == null
                    ? child
                    : Container(
                        color: AppColors.surfaceMuted,
                        child: const Center(
                          child: SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandAccent),
                          ),
                        ),
                      ),
                errorBuilder: (_, __, ___) => _fallback(),
              )
            : _fallback(),
      ),
    );
  }

  Widget _fallback() => Container(
        color: AppColors.surfaceMuted,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.photo_outlined, size: 36, color: AppColors.textMuted),
              const SizedBox(height: 8),
              Text(
                eventName,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.displaySerif.copyWith(fontSize: 15, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      );
}

// ── Meta card ──────────────────────────────────────────────────────

class _MetaCard extends StatelessWidget {
  const _MetaCard({required this.ev});
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
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: rows.map((r) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(r.$1, size: 15, color: AppColors.brandAccent),
              const SizedBox(width: 10),
              Expanded(
                child: Text(r.$2, style: const TextStyle(fontSize: 13.5, color: AppColors.textSecondary, height: 1.35)),
              ),
            ],
          ),
        )).toList(),
      ),
    );
  }
}

// ── RSVP progress ──────────────────────────────────────────────────

class _RsvpProgress extends StatelessWidget {
  const _RsvpProgress({required this.rate, required this.responded, required this.of});
  final int rate;
  final int responded;
  final int of;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
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
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$rate%',
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.5,
                  height: 1.0,
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text(
                  of > 0 ? '$responded of $of families responded' : 'No counted families yet',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: of > 0 ? (rate / 100).clamp(0.0, 1.0) : 0,
              minHeight: 6,
              backgroundColor: AppColors.surfaceMuted,
              valueColor: const AlwaysStoppedAnimation(AppColors.brandAccent),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Guest summary ──────────────────────────────────────────────────

class _GuestSummary extends StatelessWidget {
  const _GuestSummary({required this.stats});
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
          Row(
            children: [
              Expanded(child: _SummaryMetric(label: 'Families', value: '${stats.totalFamilies}')),
              _vDivider(),
              Expanded(child: _SummaryMetric(label: 'Headcount', value: '${stats.totalMaxInvited}')),
              _vDivider(),
              Expanded(child: _SummaryMetric(label: 'Men', value: '${stats.totalMen}')),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _SummaryMetric(label: 'Women', value: '${stats.totalWomen}')),
              _vDivider(),
              Expanded(child: _SummaryMetric(label: 'Kids', value: '${stats.totalKids}')),
              _vDivider(),
              Expanded(child: _SummaryMetric(label: 'Not invited', value: '${stats.notInvitedCount}', muted: true)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _vDivider() => Container(width: 1, height: 32, color: AppColors.borderLight);
}

class _SummaryMetric extends StatelessWidget {
  const _SummaryMetric({required this.label, required this.value, this.muted = false});
  final String label;
  final String value;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: muted ? AppColors.textMuted : AppColors.textPrimary,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }
}

// ── Quick action tiles ─────────────────────────────────────────────

class _QuickAction extends StatelessWidget {
  const _QuickAction({
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
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: AppColors.border),
            boxShadow: AppShadows.card,
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.brandDeep,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: AppColors.textInverse, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: AppTextStyles.titleSmall),
                    Text(sub, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Sections ───────────────────────────────────────────────────────

class _SectionsColumn extends StatelessWidget {
  const _SectionsColumn({
    required this.sec,
    required this.eventId,
    required this.eventTitle,
  });
  final EventSections sec;
  final String eventId;
  final String eventTitle;

  void _go(BuildContext context, {
    String status = 'all',
    String readiness = 'all',
    bool followup = false,
    String duplicate = 'all',
  }) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => GuestsListScreen(
          eventId: eventId,
          eventTitle: eventTitle,
          initialStatusFilter: status,
          initialReadiness: readiness,
          initialFollowup: followup,
          initialDuplicate: duplicate,
        ),
      ),
    );
  }

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

        // ── Follow-up ──
        const Text('FOLLOW-UP', style: AppTextStyles.sectionLabel),
        const SizedBox(height: 8),
        _SectionCard(
          child: SectionStatRow(
            icon: Icons.hourglass_top_rounded,
            label: 'Invited, awaiting RSVP',
            value: '${sec.followUp.awaitingRsvp}',
            color: AppColors.pending,
            onTap: sec.followUp.awaitingRsvp > 0
                ? () => _go(context, status: 'pending')
                : null,
          ),
        ),
        const SizedBox(height: 20),

        // ── Readiness ──
        const Text('READINESS', style: AppTextStyles.sectionLabel),
        const SizedBox(height: 8),
        _SectionCard(
          child: Column(
            children: [
              SectionStatRow(
                icon: Icons.send_rounded,
                label: 'Ready to send',
                value: '${sec.readiness.readyToSend}',
                color: AppColors.success,
                onTap: sec.readiness.readyToSend > 0
                    ? () => _go(context, readiness: 'ready')
                    : null,
              ),
              const _Hairline(),
              SectionStatRow(
                icon: Icons.person_off_outlined,
                label: 'Missing contact',
                value: '${sec.readiness.missingContact}',
                color: AppColors.warning,
                onTap: sec.readiness.missingContact > 0
                    ? () => _go(context, readiness: 'missing_contact')
                    : null,
              ),
              const _Hairline(),
              SectionStatRow(
                icon: Icons.mark_email_read_outlined,
                label: 'Already invited',
                value: '${sec.readiness.alreadyInvited}',
                color: AppColors.invited,
                onTap: sec.readiness.alreadyInvited > 0
                    ? () => _go(context, readiness: 'already_invited')
                    : null,
              ),
              const _Hairline(),
              SectionStatRow(
                icon: Icons.check_circle_outline_rounded,
                label: 'Responded',
                value: '${sec.readiness.responded}',
                color: AppColors.attending,
                onTap: sec.readiness.responded > 0
                    ? () => _go(context, readiness: 'responded')
                    : null,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // ── List Hygiene ──
        const Text('LIST HYGIENE', style: AppTextStyles.sectionLabel),
        const SizedBox(height: 8),
        _SectionCard(
          child: Column(
            children: [
              SectionStatRow(
                icon: Icons.copy_all_rounded,
                label: 'Possible duplicates',
                value: '${sec.listHygiene.possibleDuplicates}',
                color: sec.listHygiene.possibleDuplicates > 0
                    ? AppColors.warning
                    : AppColors.attending,
                onTap: sec.listHygiene.possibleDuplicates > 0
                    ? () => _go(context, duplicate: 'has_duplicates')
                    : null,
              ),
              const _Hairline(),
              SectionStatRow(
                icon: Icons.contact_phone_outlined,
                label: 'Missing contact',
                value: '${sec.listHygiene.missingContact}',
                color: sec.listHygiene.missingContact > 0
                    ? AppColors.warning
                    : AppColors.attending,
                onTap: sec.listHygiene.missingContact > 0
                    ? () => _go(context, readiness: 'missing_contact')
                    : null,
              ),
              const _Hairline(),
              SectionStatRow(
                icon: Icons.check_rounded,
                label: 'Send-ready',
                value: '${sec.listHygiene.sendReady}',
                color: AppColors.attending,
                onTap: sec.listHygiene.sendReady > 0
                    ? () => _go(context, readiness: 'ready')
                    : null,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // ── Communications ──
        const Text('COMMUNICATIONS', style: AppTextStyles.sectionLabel),
        const SizedBox(height: 8),
        _SectionCard(
          child: Column(
            children: [
              SectionStatRow(
                icon: Icons.history_rounded,
                label: 'Total logs',
                value: '${sec.communications.totalLogs}',
              ),
              const _Hairline(),
              SectionStatRow(
                icon: Icons.trending_up_rounded,
                label: 'Last 7 days',
                value: '${sec.communications.recentLogs}',
                color: sec.communications.recentLogs > 0 ? AppColors.brandAccent : null,
              ),
              const _Hairline(),
              SectionStatRow(
                icon: Icons.people_outline_rounded,
                label: 'Guests with history',
                value: '${sec.communications.guestsWithLogs}',
                color: AppColors.attending,
              ),
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
  Widget build(BuildContext context) => Container(
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
        border: Border.all(color: fgColor.withValues(alpha: 0.2)),
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
                  Text(
                    DateFormat('d MMM yyyy').format(deadline!),
                    style: TextStyle(fontSize: 12, color: fgColor.withValues(alpha: 0.8)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Itinerary section ──────────────────────────────────────────────

class _ItinerarySection extends StatelessWidget {
  const _ItinerarySection({required this.items});
  final List<ItineraryItem> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('ITINERARY', style: AppTextStyles.sectionLabel),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surfaceCard,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: AppColors.border),
            boxShadow: AppShadows.card,
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
                child: Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: AppColors.brandAccent.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.schedule_rounded, size: 15, color: AppColors.brandAccent),
                    ),
                    const SizedBox(width: 10),
                    const Text('Event Timeline', style: AppTextStyles.titleSmall),
                    const Spacer(),
                    Text(
                      '${items.length} item${items.length == 1 ? '' : 's'}',
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: AppColors.borderLight),
              ...items.asMap().entries.map((entry) {
                final i = entry.key;
                final item = entry.value;
                return Column(
                  children: [
                    _ItineraryRow(item: item),
                    if (i < items.length - 1)
                      const Divider(height: 1, color: AppColors.borderLight, indent: 58),
                  ],
                );
              }),
            ],
          ),
        ),
      ],
    );
  }
}

class _ItineraryRow extends StatelessWidget {
  const _ItineraryRow({required this.item});
  final ItineraryItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: AppColors.brandAccent.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.calendar_today_outlined, size: 15, color: AppColors.brandAccent),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                if (item.description != null && item.description!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    item.description!,
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.35),
                  ),
                ],
              ],
            ),
          ),
          if (item.displayTime.isNotEmpty) ...[
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: item.displayTime.split(' – ').map((t) => Text(
                t,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.brandAccent),
              )).toList(),
            ),
          ],
        ],
      ),
    );
  }
}
