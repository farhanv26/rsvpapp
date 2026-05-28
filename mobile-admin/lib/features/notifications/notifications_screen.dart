import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/models/notification.dart';
import '../../core/services/notifications_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/utils/error_message.dart';
import '../../shared/widgets/empty_state.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifAsync = ref.watch(notificationsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Notifications', style: AppTextStyles.titleLarge),
                        const SizedBox(height: 2),
                        notifAsync.maybeWhen(
                          data: (r) => Text(
                            r.unreadCount > 0 ? '${r.unreadCount} unread' : 'All caught up',
                            style: TextStyle(
                              fontSize: 13,
                              color: r.unreadCount > 0 ? AppColors.brandAccent : AppColors.textMuted,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          orElse: () => const SizedBox.shrink(),
                        ),
                      ],
                    ),
                  ),
                  notifAsync.maybeWhen(
                    data: (r) => r.unreadCount > 0
                        ? TextButton(
                            onPressed: () async {
                              await ref.read(notificationsServiceProvider).markRead(all: true);
                              ref.invalidate(notificationsProvider);
                            },
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                            child: const Text('Mark all read'),
                          )
                        : const SizedBox.shrink(),
                    orElse: () => const SizedBox.shrink(),
                  ),
                ],
              ),
            ),

            Expanded(
              child: notifAsync.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(color: AppColors.brandAccent, strokeWidth: 2),
                ),
                error: (e, _) => ErrorView(
                  message: userFacingErrorMessage(e),
                  onRetry: () => ref.invalidate(notificationsProvider),
                ),
                data: (result) {
                  if (result.notifications.isEmpty) {
                    return const EmptyState(
                      icon: Icons.notifications_none_rounded,
                      title: 'No notifications',
                      subtitle: 'Guest RSVPs and activity will appear here.',
                    );
                  }

                  final grouped = _groupByDate(result.notifications);
                  final keys = grouped.keys.toList();

                  return RefreshIndicator(
                    color: AppColors.brandAccent,
                    backgroundColor: AppColors.surfaceCard,
                    onRefresh: () async => ref.invalidate(notificationsProvider),
                    child: ListView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                      itemCount: _flatCount(grouped),
                      itemBuilder: (context, i) {
                        final (key, item) = _flatItem(grouped, keys, i);
                        if (item == null) {
                          return _DateHeader(label: key);
                        }
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: _NotificationTile(
                            notification: item,
                            onMarkRead: () async {
                              await ref.read(notificationsServiceProvider).markRead(id: item.id);
                              ref.invalidate(notificationsProvider);
                            },
                          ),
                        );
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Map<String, List<AppNotification>> _groupByDate(List<AppNotification> items) {
    final map = <String, List<AppNotification>>{};
    for (final n in items) {
      final key = _dayLabel(n.createdAt.toLocal());
      map.putIfAbsent(key, () => []).add(n);
    }
    return map;
  }

  String _dayLabel(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final d = DateTime(dt.year, dt.month, dt.day);
    final diff = today.difference(d).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    if (diff < 7) return DateFormat('EEEE').format(dt);
    return DateFormat('d MMMM yyyy').format(dt);
  }

  int _flatCount(Map<String, List<AppNotification>> grouped) {
    int count = 0;
    for (final v in grouped.values) {
      count += 1 + v.length;
    }
    return count;
  }

  (String, AppNotification?) _flatItem(
    Map<String, List<AppNotification>> grouped,
    List<String> keys,
    int index,
  ) {
    int cursor = 0;
    for (final key in keys) {
      if (index == cursor) return (key, null);
      cursor++;
      final items = grouped[key]!;
      if (index < cursor + items.length) return (key, items[index - cursor]);
      cursor += items.length;
    }
    return ('', null);
  }
}

// ── Date header ────────────────────────────────────────────────────

class _DateHeader extends StatelessWidget {
  const _DateHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 8, 0, 8),
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

// ── Notification tile ──────────────────────────────────────────────

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onMarkRead});
  final AppNotification notification;
  final VoidCallback onMarkRead;

  @override
  Widget build(BuildContext context) {
    final isUnread = !notification.read;
    return GestureDetector(
      onTap: isUnread ? onMarkRead : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isUnread ? AppColors.brandAccentLight : AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: isUnread ? AppColors.brandAccent.withValues(alpha: 0.2) : AppColors.border,
          ),
          boxShadow: isUnread ? null : AppShadows.card,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _TypeIcon(type: notification.type, unread: isUnread),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notification.title,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: isUnread ? FontWeight.w600 : FontWeight.w500,
                      color: AppColors.textPrimary,
                      height: 1.3,
                    ),
                  ),
                  if (notification.description != null && notification.description!.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      notification.description!,
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 5),
                  Text(
                    _timeAgo(notification.createdAt),
                    style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            if (isUnread)
              Padding(
                padding: const EdgeInsets.only(top: 5, left: 8),
                child: Container(
                  width: 7,
                  height: 7,
                  decoration: const BoxDecoration(
                    color: AppColors.brandAccent,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('d MMM').format(dt);
  }
}

class _TypeIcon extends StatelessWidget {
  const _TypeIcon({required this.type, required this.unread});
  final String type;
  final bool unread;

  @override
  Widget build(BuildContext context) {
    final (icon, color) = switch (type) {
      String t when t.contains('rsvp') => (Icons.how_to_reg_rounded, AppColors.attending),
      String t when t.contains('guest') => (Icons.person_rounded, AppColors.brandAccent),
      String t when t.contains('event') => (Icons.event_rounded, AppColors.invited),
      _ => (Icons.notifications_rounded, AppColors.textSecondary),
    };
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: color.withValues(alpha: unread ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(11),
        border: unread ? Border.all(color: color.withValues(alpha: 0.2)) : null,
      ),
      child: Icon(icon, color: color, size: 17),
    );
  }
}
