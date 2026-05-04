import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/models/activity.dart';
import '../../core/services/events_service.dart';
import '../../shared/theme/app_theme.dart';
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
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 1,
        shadowColor: AppColors.border,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(eventTitle, style: AppTextStyles.titleMedium),
            const Text(
              'Recent activity',
              style: TextStyle(
                  fontSize: 11,
                  color: AppColors.textMuted,
                  fontWeight: FontWeight.w400),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () =>
                ref.invalidate(eventActivityProvider(eventId)),
          ),
        ],
      ),
      body: activityAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(
                color: AppColors.brandAccent, strokeWidth: 2)),
        error: (e, _) => ErrorView(
          message: e
              .toString()
              .replaceFirst('ApiException', '')
              .replaceAll(':', '')
              .trim(),
          onRetry: () =>
              ref.invalidate(eventActivityProvider(eventId)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const EmptyState(
              icon: Icons.history_rounded,
              title: 'No activity yet',
              subtitle:
                  'RSVP updates, invites, and changes will appear here.',
            );
          }

          return RefreshIndicator(
            color: AppColors.brandAccent,
            onRefresh: () async =>
                ref.invalidate(eventActivityProvider(eventId)),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 48),
              itemCount: _buildItems(items).length,
              itemBuilder: (_, i) {
                final row = _buildItems(items)[i];
                if (row is _DateHeader) {
                  return _DateHeaderTile(label: row.label);
                }
                final item = row as ActivityItem;
                final isLast = _isLastBeforeHeader(items, i, _buildItems(items));
                return _ActivityRow(item: item, isLast: isLast);
              },
            ),
          );
        },
      ),
    );
  }

  // Interleave date headers into flat list
  List<dynamic> _buildItems(List<ActivityItem> items) {
    final result = <dynamic>[];
    String? lastDate;
    for (final item in items) {
      final dateKey = _dayKey(item.createdAt.toLocal());
      if (dateKey != lastDate) {
        result.add(_DateHeader(label: _formatDateHeader(item.createdAt.toLocal())));
        lastDate = dateKey;
      }
      result.add(item);
    }
    return result;
  }

  bool _isLastBeforeHeader(
      List<ActivityItem> items, int flatIndex, List<dynamic> flat) {
    if (flatIndex >= flat.length - 1) return true;
    return flat[flatIndex + 1] is _DateHeader;
  }

  String _dayKey(DateTime dt) =>
      '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';

  String _formatDateHeader(DateTime dt) {
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

class _DateHeader {
  const _DateHeader({required this.label});
  final String label;
}

// ── Date separator ─────────────────────────────────────────────────

class _DateHeaderTile extends StatelessWidget {
  const _DateHeaderTile({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 4, 0, 10),
      child: Row(
        children: [
          Text(
            label.toUpperCase(),
            style: AppTextStyles.sectionLabel,
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Divider(
                height: 1, color: AppColors.borderLight, thickness: 1),
          ),
        ],
      ),
    );
  }
}

// ── Activity row with timeline connector ──────────────────────────

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.item, required this.isLast});

  final ActivityItem item;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final (icon, color) = _typeStyle(item.type);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Timeline column
          SizedBox(
            width: 44,
            child: Column(
              children: [
                // Icon circle
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: color.withValues(alpha: 0.18), width: 1),
                  ),
                  child: Icon(icon, size: 16, color: color),
                ),
                // Connecting line
                if (!isLast)
                  Expanded(
                    child: Center(
                      child: Container(
                        width: 1.5,
                        margin: const EdgeInsets.only(top: 3),
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
              padding: EdgeInsets.fromLTRB(
                  0, 0, 0, isLast ? 0 : 16),
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
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _formatTime(item.createdAt),
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textMuted,
                    ),
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

  (IconData, Color) _typeStyle(String type) {
    switch (type) {
      case 'rsvp_attending':
        return (Icons.check_circle_rounded, AppColors.attending);
      case 'rsvp_declined':
        return (Icons.cancel_rounded, AppColors.declined);
      case 'guest_invited':
        return (Icons.send_rounded, AppColors.invited);
      case 'guest_uninvited':
        return (
            Icons.remove_circle_outline_rounded, AppColors.textMuted);
      case 'guest_created':
        return (Icons.person_add_rounded, AppColors.brandAccent);
      case 'guest_updated':
        return (Icons.edit_rounded, AppColors.brandMid);
      case 'guest_deleted':
        return (Icons.delete_rounded, AppColors.danger);
      default:
        return (Icons.history_rounded, AppColors.textSecondary);
    }
  }

  String _formatTime(DateTime dt) {
    final local = dt.toLocal();
    final now = DateTime.now();
    final diff = now.difference(local);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return DateFormat('h:mm a').format(local);
  }
}
