import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/models/notification.dart';
import '../../core/services/notifications_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/empty_state.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifAsync = ref.watch(notificationsProvider);

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          notifAsync.maybeWhen(
            data: (result) => result.unreadCount > 0
                ? TextButton(
                    onPressed: () async {
                      await ref.read(notificationsServiceProvider).markRead(all: true);
                      ref.invalidate(notificationsProvider);
                    },
                    child: const Text('Mark all read'),
                  )
                : const SizedBox.shrink(),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: notifAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: e.toString().replaceFirst('ApiException', '').replaceAll(':', '').trim(),
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
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(notificationsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
              itemCount: result.notifications.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final notif = result.notifications[i];
                return _NotificationTile(
                  notification: notif,
                  onMarkRead: () async {
                    await ref.read(notificationsServiceProvider).markRead(id: notif.id);
                    ref.invalidate(notificationsProvider);
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onMarkRead});

  final AppNotification notification;
  final VoidCallback onMarkRead;

  @override
  Widget build(BuildContext context) {
    final timeAgo = _formatTimeAgo(notification.createdAt);

    return GestureDetector(
      onTap: notification.read ? null : onMarkRead,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: notification.read ? AppColors.surfaceCard : AppColors.primaryLight,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: notification.read ? AppColors.border : AppColors.primary.withAlpha(80),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _typeIcon(notification.type),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notification.title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: notification.read ? FontWeight.normal : FontWeight.w600,
                      color: AppColors.textPrimary,
                      height: 1.3,
                    ),
                  ),
                  if (notification.description != null && notification.description!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      notification.description!,
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 6),
                  Text(timeAgo, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                ],
              ),
            ),
            if (!notification.read) ...[
              const SizedBox(width: 8),
              Container(
                width: 8, height: 8,
                decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _typeIcon(String type) {
    final (icon, color) = switch (type) {
      String t when t.contains('rsvp') => (Icons.how_to_reg_rounded, AppColors.attending),
      String t when t.contains('guest') => (Icons.person_rounded, AppColors.primary),
      String t when t.contains('event') => (Icons.event_rounded, AppColors.accent),
      _ => (Icons.notifications_rounded, AppColors.textSecondary),
    };
    return Container(
      width: 36, height: 36,
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, color: color, size: 18),
    );
  }

  String _formatTimeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('d MMM').format(dt);
  }
}
