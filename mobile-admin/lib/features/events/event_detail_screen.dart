import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/services/events_service.dart';
import '../../core/services/guests_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/empty_state.dart';
import '../guests/guests_list_screen.dart';
import 'widgets/stat_card.dart';

class EventDetailScreen extends ConsumerWidget {
  const EventDetailScreen({super.key, required this.eventId});

  final String eventId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(eventDetailProvider(eventId));
    final sectionsAsync = ref.watch(eventSectionsProvider(eventId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: detailAsync.maybeWhen(
          data: (d) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(d.event.displayName, style: AppTextStyles.titleMedium),
              const Text('Event dashboard',
                  style: TextStyle(
                      fontSize: 11,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w400)),
            ],
          ),
          orElse: () => const Text('Event'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              ref.invalidate(eventDetailProvider(eventId));
              ref.invalidate(eventSectionsProvider(eventId));
            },
          ),
        ],
      ),
      body: detailAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.brandAccent)),
        error: (e, _) => ErrorView(
          message: e
              .toString()
              .replaceFirst('ApiException', '')
              .replaceAll(':', '')
              .trim(),
          onRetry: () => ref.invalidate(eventDetailProvider(eventId)),
        ),
        data: (detail) {
          final ev = detail.event;
          final s = detail.stats;
          return RefreshIndicator(
            color: AppColors.brandAccent,
            onRefresh: () async {
              ref.invalidate(eventDetailProvider(eventId));
              ref.invalidate(eventSectionsProvider(eventId));
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 48),
              children: [
                // RSVP deadline alert (from sections)
                sectionsAsync.maybeWhen(
                  data: (sec) {
                    final dl = sec.rsvpDeadline;
                    if (dl.status == 'none' || dl.status == 'open') {
                      return const SizedBox.shrink();
                    }
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: _DeadlineAlert(
                          status: dl.status, deadline: dl.deadline),
                    );
                  },
                  orElse: () => const SizedBox.shrink(),
                ),

                // Event info card
                _InfoCard(ev: ev),
                const SizedBox(height: 14),

                // Guest list shortcut
                _GuestShortcutButton(
                  guestCount: s.totalFamilies,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => GuestsListScreen(
                          eventId: eventId, eventTitle: ev.displayName),
                    ),
                  ),
                ),
                const SizedBox(height: 22),

                // Section label
                const _SectionLabel('Overview'),
                const SizedBox(height: 10),

                // Stat grid
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 1.3,
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
                      progress: s.totalFamilies > 0
                          ? s.attendingFamilies / s.totalFamilies
                          : 0.0,
                    ),
                    StatCard(
                      label: 'Declined',
                      value: '${s.declinedFamilies}',
                      color: AppColors.declined,
                      progress: s.totalFamilies > 0
                          ? s.declinedFamilies / s.totalFamilies
                          : 0.0,
                    ),
                    StatCard(
                      label: 'Confirmed',
                      value: '${s.confirmedAttendees}',
                      sub: 'total attendees',
                      color: AppColors.brandAccent,
                      progress: s.totalMaxInvited > 0
                          ? (s.confirmedAttendees / s.totalMaxInvited)
                              .clamp(0.0, 1.0)
                          : 0.0,
                    ),
                    StatCard(
                      label: 'Invited',
                      value: '${s.invitedFamilies}',
                      progress: s.totalFamilies > 0
                          ? s.invitedFamilies / s.totalFamilies
                          : 0.0,
                    ),
                    StatCard(
                      label: 'Awaiting RSVP',
                      value: '${s.awaitingRsvpCount}',
                      color: AppColors.pending,
                      progress: s.invitedFamilies > 0
                          ? (s.awaitingRsvpCount / s.invitedFamilies)
                              .clamp(0.0, 1.0)
                          : 0.0,
                    ),
                  ],
                ),
                const SizedBox(height: 22),

                // Breakdown
                const _SectionLabel('Breakdown'),
                const SizedBox(height: 10),
                _Card(
                  child: Column(
                    children: [
                      StatRow(label: 'Total families', value: '${s.totalFamilies}'),
                      const Divider(height: 1, color: AppColors.borderLight),
                      StatRow(label: 'Counted in totals', value: '${s.countedFamilies}'),
                      const Divider(height: 1, color: AppColors.borderLight),
                      StatRow(label: 'Max capacity', value: '${s.totalMaxInvited}'),
                      const Divider(height: 1, color: AppColors.borderLight),
                      StatRow(label: 'Men', value: '${s.totalMen}'),
                      const Divider(height: 1, color: AppColors.borderLight),
                      StatRow(label: 'Women', value: '${s.totalWomen}'),
                      const Divider(height: 1, color: AppColors.borderLight),
                      StatRow(label: 'Kids', value: '${s.totalKids}'),
                      const Divider(height: 1, color: AppColors.borderLight),
                      StatRow(label: 'Not yet invited', value: '${s.notInvitedCount}'),
                      const Divider(height: 1, color: AppColors.borderLight),
                      StatRow(label: 'Pending response', value: '${s.totalPending}'),
                    ],
                  ),
                ),
                const SizedBox(height: 22),

                // Dashboard sections from /sections API
                sectionsAsync.when(
                  loading: () => const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: CircularProgressIndicator(
                          color: AppColors.brandAccent, strokeWidth: 2),
                    ),
                  ),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (sec) => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Follow-up
                      const _SectionLabel('Follow-up'),
                      const SizedBox(height: 10),
                      _Card(
                        child: SectionStatRow(
                          icon: Icons.hourglass_top_rounded,
                          label: 'Invited, awaiting RSVP',
                          value: '${sec.followUp.awaitingRsvp}',
                          color: AppColors.pending,
                        ),
                      ),
                      const SizedBox(height: 22),

                      // Readiness
                      const _SectionLabel('Readiness'),
                      const SizedBox(height: 10),
                      _Card(
                        child: Column(
                          children: [
                            SectionStatRow(
                              icon: Icons.send_rounded,
                              label: 'Ready to send',
                              value: '${sec.readiness.readyToSend}',
                              color: AppColors.success,
                            ),
                            const Divider(height: 1, color: AppColors.borderLight),
                            SectionStatRow(
                              icon: Icons.person_off_outlined,
                              label: 'Missing contact info',
                              value: '${sec.readiness.missingContact}',
                              color: AppColors.warning,
                            ),
                            const Divider(height: 1, color: AppColors.borderLight),
                            SectionStatRow(
                              icon: Icons.mark_email_read_outlined,
                              label: 'Already invited',
                              value: '${sec.readiness.alreadyInvited}',
                              color: AppColors.invited,
                            ),
                            const Divider(height: 1, color: AppColors.borderLight),
                            SectionStatRow(
                              icon: Icons.check_circle_outline_rounded,
                              label: 'Responded',
                              value: '${sec.readiness.responded}',
                              color: AppColors.attending,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 22),

                      // List hygiene
                      const _SectionLabel('List Hygiene'),
                      const SizedBox(height: 10),
                      _Card(
                        child: Column(
                          children: [
                            SectionStatRow(
                              icon: Icons.copy_all_rounded,
                              label: 'Possible duplicates',
                              value: '${sec.listHygiene.possibleDuplicates}',
                              color: sec.listHygiene.possibleDuplicates > 0
                                  ? AppColors.warning
                                  : AppColors.attending,
                            ),
                            const Divider(height: 1, color: AppColors.borderLight),
                            SectionStatRow(
                              icon: Icons.contact_phone_outlined,
                              label: 'Missing contact',
                              value: '${sec.listHygiene.missingContact}',
                              color: sec.listHygiene.missingContact > 0
                                  ? AppColors.warning
                                  : AppColors.attending,
                            ),
                            const Divider(height: 1, color: AppColors.borderLight),
                            SectionStatRow(
                              icon: Icons.check_rounded,
                              label: 'Send-ready guests',
                              value: '${sec.listHygiene.sendReady}',
                              color: AppColors.attending,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 22),

                      // Communications
                      const _SectionLabel('Communications'),
                      const SizedBox(height: 10),
                      _Card(
                        child: Column(
                          children: [
                            SectionStatRow(
                              icon: Icons.history_rounded,
                              label: 'Total logs recorded',
                              value: '${sec.communications.totalLogs}',
                            ),
                            const Divider(height: 1, color: AppColors.borderLight),
                            SectionStatRow(
                              icon: Icons.trending_up_rounded,
                              label: 'Actions in last 7 days',
                              value: '${sec.communications.recentLogs}',
                              color: sec.communications.recentLogs > 0
                                  ? AppColors.brandAccent
                                  : null,
                            ),
                            const Divider(height: 1, color: AppColors.borderLight),
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
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Shared widgets ──────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text.toUpperCase(), style: AppTextStyles.sectionLabel);
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: child,
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.ev});
  final dynamic ev;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (ev.eventSubtitle != null)
            Text(ev.eventSubtitle!,
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary)),
          if (ev.eventDate != null) ...[
            const SizedBox(height: 8),
            _infoRow(
              Icons.calendar_today_outlined,
              '${DateFormat('EEEE, d MMMM yyyy').format(ev.eventDate!)}'
              '${ev.eventTime != null ? '  ·  ${ev.eventTime}' : ''}',
            ),
          ],
          if (ev.venue != null) ...[
            const SizedBox(height: 6),
            _infoRow(Icons.location_on_outlined, ev.venue!),
          ],
          if (ev.rsvpDeadline != null) ...[
            const SizedBox(height: 6),
            _infoRow(
              Icons.access_time_rounded,
              'RSVP by ${DateFormat('d MMM yyyy').format(ev.rsvpDeadline!)}',
            ),
          ],
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 14, color: AppColors.textMuted),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
        ),
      ],
    );
  }
}

class _GuestShortcutButton extends StatelessWidget {
  const _GuestShortcutButton(
      {required this.guestCount, required this.onTap});
  final int guestCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.brandMid, Color(0xFF302216)],
          ),
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF302216).withValues(alpha: 0.28),
              offset: const Offset(0, 6),
              blurRadius: 20,
              spreadRadius: -4,
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.people_rounded,
                  color: AppColors.textInverse, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$guestCount guest${guestCount == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textInverse,
                      letterSpacing: -0.3,
                    ),
                  ),
                  Text(
                    'View & manage guest list',
                    style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textInverse.withValues(alpha: 0.7)),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded,
                color: AppColors.textInverse),
          ],
        ),
      ),
    );
  }
}

class _DeadlineAlert extends StatelessWidget {
  const _DeadlineAlert({required this.status, this.deadline});
  final String status;
  final DateTime? deadline;

  @override
  Widget build(BuildContext context) {
    final isUrgent = status == 'closes_today' || status == 'closed';
    final bgColor = isUrgent ? AppColors.dangerBg : AppColors.pendingBg;
    final fgColor = isUrgent ? AppColors.danger : AppColors.pending;
    final icon =
        status == 'closed' ? Icons.lock_clock_rounded : Icons.timer_outlined;
    final label = switch (status) {
      'closed' => 'RSVP closed',
      'closes_today' => 'RSVP closes today',
      'closing_soon' => 'RSVP closing soon',
      _ => 'RSVP deadline',
    };
    final sub = deadline != null
        ? DateFormat('d MMM yyyy').format(deadline!)
        : null;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: fgColor.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: fgColor),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: fgColor)),
                if (sub != null)
                  Text(sub,
                      style: TextStyle(
                          fontSize: 12, color: fgColor.withValues(alpha: 0.7))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
