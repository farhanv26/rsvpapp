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
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Notifications', style: AppTextStyles.titleMedium),
            notifAsync.maybeWhen(
              data: (r) => Text(
                r.unreadCount > 0 ? '${r.unreadCount} unread' : 'All caught up',
                style: TextStyle(
                  fontSize: 11,
                  color: r.unreadCount > 0 ? AppColors.brandAccent : AppColors.textMuted,
                  fontWeight: FontWeight.w500,
                ),
              ),
              orElse: () => const SizedBox.shrink(),
            ),
          ],
        ),
        actions: [
          notifAsync.maybeWhen(
            data: (result) => result.unreadCount > 0
                ? TextButton(
                    onPressed: () async {
                      await ref.read(notificationsServiceProvider).markRead(all: true);
                      ref.invalidate(notificationsProvider);
                    },
                    child: const Text(
                      'Mark all read',
                      style: TextStyle(color: AppColors.brandAccent, fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                  )
                : const SizedBox.shrink(),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: notifAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.brandAccent, strokeWidth: 2),
        ),
        error: (e, _) {
          final msg = e.toString().replaceFirst('ApiException', '').replaceAll(':', '').trim();
          return _ErrorState(message: msg, onRetry: () => ref.invalidate(notificationsProvider));
        },
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
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 48),
              itemCount: _flatCount(grouped),
              itemBuilder: (context, i) {
                final (key, item) = _flatItem(grouped, keys, i);
                if (item == null) return _DateHeader(label: key);
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

// ── Error state with helpful context ──────────────────────────────

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.dangerBg,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.notifications_off_outlined, color: AppColors.danger, size: 26),
            ),
            const SizedBox(height: 16),
            const Text(
              'Could not load notifications',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message.isNotEmpty ? message : 'Check your connection and server settings.',
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: onRetry,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceCard,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.refresh_rounded, size: 16, color: AppColors.brandAccent),
                    SizedBox(width: 8),
                    Text('Retry', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.brandAccent)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Date group header ──────────────────────────────────────────────

class _DateHeader extends StatelessWidget {
  const _DateHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 4, 0, 10),
      child: Row(
        children: [
          Text(label.toUpperCase(), style: AppTextStyles.sectionLabel),
          const SizedBox(width: 10),
          const Expanded(child: Divider(height: 1, color: AppColors.border, thickness: 1)),
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
    final timeAgo = _timeAgo(notification.createdAt);

    return GestureDetector(
      onTap: isUnread ? onMarkRead : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isUnread ? AppColors.brandAccentLight : AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: isUnread ? AppColors.brandAccent.withValues(alpha: 0.25) : AppColors.border,
          ),
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
                      fontSize: 14,
                      fontWeight: isUnread ? FontWeight.w600 : FontWeight.w500,
                      color: AppColors.textPrimary,
                      height: 1.35,
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
                  Text(timeAgo, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                ],
              ),
            ),
            if (isUnread)
              Padding(
                padding: const EdgeInsets.only(top: 4, left: 8),
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(color: AppColors.brandAccent, shape: BoxShape.circle),
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

// ── Type icon ──────────────────────────────────────────────────────

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
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: color.withValues(alpha: unread ? 0.18 : 0.1),
        borderRadius: BorderRadius.circular(12),
        border: unread ? Border.all(color: color.withValues(alpha: 0.25)) : null,
      ),
      child: Icon(icon, color: color, size: 18),
    );
  }
}
