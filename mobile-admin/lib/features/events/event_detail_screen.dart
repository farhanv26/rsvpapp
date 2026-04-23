import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/services/events_service.dart';
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

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: detailAsync.maybeWhen(
          data: (d) => Text(d.event.displayName),
          orElse: () => const Text('Event'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(eventDetailProvider(eventId)),
          ),
        ],
      ),
      body: detailAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: e.toString().replaceFirst('ApiException', '').replaceAll(':', '').trim(),
          onRetry: () => ref.invalidate(eventDetailProvider(eventId)),
        ),
        data: (detail) {
          final ev = detail.event;
          final s = detail.stats;
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(eventDetailProvider(eventId)),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
              children: [
                // Event info header
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceCard,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (ev.eventSubtitle != null)
                        Text(ev.eventSubtitle!, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                      if (ev.eventDate != null) ...[
                        const SizedBox(height: 8),
                        _infoRow(Icons.calendar_today_outlined,
                          '${DateFormat('EEEE, d MMMM yyyy').format(ev.eventDate!)}${ev.eventTime != null ? '  ·  ${ev.eventTime}' : ''}'),
                      ],
                      if (ev.venue != null) ...[
                        const SizedBox(height: 6),
                        _infoRow(Icons.location_on_outlined, ev.venue!),
                      ],
                      if (ev.rsvpDeadline != null) ...[
                        const SizedBox(height: 6),
                        _infoRow(Icons.access_time_rounded,
                          'RSVP by ${DateFormat('d MMM yyyy').format(ev.rsvpDeadline!)}'),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Guest list shortcut
                GestureDetector(
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => GuestsListScreen(eventId: eventId, eventTitle: ev.displayName)),
                  ),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.people_rounded, color: Colors.white, size: 22),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${s.totalFamilies} guests', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                              Text('View & manage guest list', style: TextStyle(fontSize: 12, color: Colors.white.withAlpha(200))),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right_rounded, color: Colors.white),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Stats header
                const Text('Overview', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 0.5)),
                const SizedBox(height: 10),

                // 2-col stat grid
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 1.5,
                  children: [
                    StatCard(label: 'Responded', value: '${s.totalResponded}', sub: '${s.responseRate}% response rate'),
                    StatCard(label: 'Attending', value: '${s.attendingFamilies}', color: AppColors.attending),
                    StatCard(label: 'Declined', value: '${s.declinedFamilies}', color: AppColors.declined),
                    StatCard(label: 'Confirmed attendees', value: '${s.confirmedAttendees}', color: AppColors.primary),
                    StatCard(label: 'Invited', value: '${s.invitedFamilies}'),
                    StatCard(label: 'Awaiting RSVP', value: '${s.awaitingRsvpCount}', color: AppColors.pending),
                  ],
                ),
                const SizedBox(height: 20),

                // Detailed breakdown
                const Text('Breakdown', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary, letterSpacing: 0.5)),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceCard,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      StatRow(label: 'Total families', value: '${s.totalFamilies}'),
                      _divider(),
                      StatRow(label: 'Counted in totals', value: '${s.countedFamilies}'),
                      _divider(),
                      StatRow(label: 'Max capacity', value: '${s.totalMaxInvited}'),
                      _divider(),
                      StatRow(label: 'Men', value: '${s.totalMen}'),
                      _divider(),
                      StatRow(label: 'Women', value: '${s.totalWomen}'),
                      _divider(),
                      StatRow(label: 'Kids', value: '${s.totalKids}'),
                      _divider(),
                      StatRow(label: 'Not yet invited', value: '${s.notInvitedCount}'),
                      _divider(),
                      StatRow(label: 'Pending response', value: '${s.totalPending}'),
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

  Widget _infoRow(IconData icon, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 14, color: AppColors.textSecondary),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary))),
      ],
    );
  }

  Widget _divider() => const Divider(height: 1, color: AppColors.borderLight);
}
