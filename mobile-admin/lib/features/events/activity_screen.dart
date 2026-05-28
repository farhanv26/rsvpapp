import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/models/activity.dart';
import '../../core/services/events_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/utils/error_message.dart';
import '../../shared/widgets/empty_state.dart';

class ActivityScreen extends ConsumerWidget {
  const ActivityScreen({
    super.key,
    required this.eventId,
    required this.eventTitle,
  });

  final String eventId;
  final String eventTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activityAsync = ref.watch(eventActivityProvider(eventId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(eventTitle, style: AppTextStyles.titleMedium),
            const Text(
              'Activity log',
              style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w400),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            onPressed: () => ref.invalidate(eventActivityProvider(eventId)),
          ),
        ],
      ),
      body: activityAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.brandAccent, strokeWidth: 2),
        ),
        error: (e, _) => ErrorView(
          message: userFacingErrorMessage(e),
          onRetry: () => ref.invalidate(eventActivityProvider(eventId)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const EmptyState(
              icon: Icons.history_rounded,
              title: 'No activity yet',
              subtitle: 'RSVP updates, invites, and changes will appear here.',
            );
          }

          final flat = _buildFlat(items);
          return RefreshIndicator(
            color: AppColors.brandAccent,
            onRefresh: () async => ref.invalidate(eventActivityProvider(eventId)),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 48),
              itemCount: flat.length,
              itemBuilder: (_, i) {
                final row = flat[i];
                if (row is _Header) return _DateTile(label: row.label);
                final item = row as ActivityItem;
                final isLast = _isLastBeforeHeader(i, flat);
                return _ActivityRow(item: item, isLast: isLast);
              },
            ),
          );
        },
      ),
    );
  }

  List<dynamic> _buildFlat(List<ActivityItem> items) {
    final result = <dynamic>[];
    String? lastDate;
    for (final item in items) {
      final dateKey = _dayKey(item.createdAt.toLocal());
      if (dateKey != lastDate) {
        result.add(_Header(label: _formatDate(item.createdAt.toLocal())));
        lastDate = dateKey;
      }
      result.add(item);
    }
    return result;
  }

  bool _isLastBeforeHeader(int i, List<dynamic> flat) {
    if (i >= flat.length - 1) return true;
    return flat[i + 1] is _Header;
  }

  String _dayKey(DateTime dt) =>
      '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final d = DateTime(dt.year, dt.month, dt.day);
    final diff = today.difference(d).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    if (diff < 7) return DateFormat('EEEE').format(dt);
    return DateFormat('d MMMM yyyy').format(dt);
  }
}

class _Header {
  const _Header({required this.label});
  final String label;
}

class _DateTile extends StatelessWidget {
  const _DateTile({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 8, 0, 10),
      child: Row(
        children: [
          Text(label.toUpperCase(), style: AppTextStyles.sectionLabel),
          const SizedBox(width: 10),
          const Expanded(child: Divider(height: 1, color: AppColors.border)),
        ],
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.item, required this.isLast});
  final ActivityItem item;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final (icon, color) = _style(item.type);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Timeline
          SizedBox(
            width: 44,
            child: Column(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: color.withValues(alpha: 0.15)),
                  ),
                  child: Icon(icon, size: 16, color: color),
                ),
                if (!isLast)
                  Expanded(
                    child: Center(
                      child: Container(
                        width: 1.5,
                        margin: const EdgeInsets.only(top: 4),
                        color: AppColors.borderLight,
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // Content
          Expanded(
            child: Padding(
              padding: EdgeInsets.fromLTRB(0, 0, 0, isLast ? 0 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 4),
                  Text(
                    item.guestName,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.description,
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _formatTime(item.createdAt),
                    style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 4),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  (IconData, Color) _style(String type) {
    return switch (type) {
      'rsvp_attending' => (Icons.check_circle_rounded, AppColors.attending),
      'rsvp_declined' => (Icons.cancel_rounded, AppColors.declined),
      'guest_invited' => (Icons.send_rounded, AppColors.invited),
      'guest_uninvited' => (Icons.remove_circle_outline_rounded, AppColors.textMuted),
      'guest_created' => (Icons.person_add_rounded, AppColors.brandAccent),
      'guest_updated' => (Icons.edit_rounded, AppColors.brandMid),
      'guest_deleted' => (Icons.delete_rounded, AppColors.danger),
      _ => (Icons.history_rounded, AppColors.textSecondary),
    };
  }

  String _formatTime(DateTime dt) {
    final local = dt.toLocal();
    final diff = DateTime.now().difference(local);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return DateFormat('h:mm a').format(local);
  }
}
