import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/models/admin_user.dart';
import '../../core/services/events_service.dart';
import '../../core/services/users_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/utils/error_message.dart';
import '../../shared/widgets/empty_state.dart';

class DeletedEventsScreen extends ConsumerWidget {
  const DeletedEventsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(deletedEventsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Deleted Events', style: AppTextStyles.titleMedium),
            Text(
              'Restore within 30 days',
              style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w400),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            onPressed: () => ref.invalidate(deletedEventsProvider),
          ),
        ],
      ),
      body: eventsAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.brandAccent, strokeWidth: 2),
        ),
        error: (e, _) => ErrorView(
          message: userFacingErrorMessage(e),
          onRetry: () => ref.invalidate(deletedEventsProvider),
        ),
        data: (events) {
          if (events.isEmpty) {
            return const EmptyState(
              icon: Icons.delete_outline_rounded,
              title: 'No deleted events',
              subtitle: 'Deleted events will appear here and can be restored.',
            );
          }
          return RefreshIndicator(
            color: AppColors.brandAccent,
            backgroundColor: AppColors.surfaceCard,
            onRefresh: () async => ref.invalidate(deletedEventsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
              itemCount: events.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) => _DeletedEventCard(
                event: events[i],
                onRestored: () {
                  ref.invalidate(deletedEventsProvider);
                  ref.invalidate(eventsListProvider);
                },
              ),
            ),
          );
        },
      ),
    );
  }
}

class _DeletedEventCard extends ConsumerWidget {
  const _DeletedEventCard({required this.event, required this.onRestored});
  final DeletedEvent event;
  final VoidCallback onRestored;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.card,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.dangerBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.delete_outline_rounded, size: 20, color: AppColors.danger),
          ),
          const SizedBox(width: 14),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(event.displayName, style: AppTextStyles.titleSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 10,
                  runSpacing: 4,
                  children: [
                    _MetaRow(icon: Icons.people_outline_rounded, label: '${event.guestCount} guests'),
                    if (event.eventDate != null)
                      _MetaRow(
                        icon: Icons.calendar_today_outlined,
                        label: DateFormat('d MMM yyyy').format(event.eventDate!),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'Deleted ${DateFormat('d MMM yyyy').format(event.deletedAt.toLocal())}',
                  style: const TextStyle(fontSize: 11, color: AppColors.danger, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          // Restore button
          TextButton(
            onPressed: () => _confirmRestore(context, ref),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.attending,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            ),
            child: const Text('Restore'),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmRestore(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Restore event?'),
        content: Text('Restore "${event.displayName}" and all its guests?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.attending),
            child: const Text('Restore'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    try {
      await ref.read(usersServiceProvider).restoreEvent(event.id);
      onRestored();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('"${event.displayName}" restored.')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(userFacingErrorMessage(e))),
        );
      }
    }
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: AppColors.textMuted),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
        ],
      );
}
