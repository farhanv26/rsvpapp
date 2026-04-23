import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/events_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/empty_state.dart';
import '../notifications/notifications_screen.dart';
import 'event_detail_screen.dart';
import 'widgets/event_card.dart';

class EventsListScreen extends ConsumerWidget {
  const EventsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(eventsListProvider);
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: Text(user != null ? 'Hi, ${user.name.split(' ').first}' : 'Events'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded),
            tooltip: 'Notifications',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const NotificationsScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Sign out',
            onPressed: () => _confirmLogout(context, ref),
          ),
        ],
      ),
      body: eventsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: e.toString().replaceFirst('ApiException', '').replaceAll(':', '').trim(),
          onRetry: () => ref.invalidate(eventsListProvider),
        ),
        data: (events) {
          if (events.isEmpty) {
            return const EmptyState(
              icon: Icons.event_note_outlined,
              title: 'No events yet',
              subtitle: 'Events you create on the web will appear here.',
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.invalidate(eventsListProvider),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              itemCount: events.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final event = events[i];
                return EventCard(
                  event: event,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => EventDetailScreen(eventId: event.id)),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?'),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.declined),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(currentUserProvider.notifier).logout();
    }
  }
}
