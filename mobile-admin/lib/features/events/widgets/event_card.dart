import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/models/event.dart';
import '../../../shared/theme/app_theme.dart';

class EventCard extends StatelessWidget {
  const EventCard({super.key, required this.event, required this.onTap});

  final Event event;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dateStr = event.eventDate != null
        ? DateFormat('d MMM yyyy').format(event.eventDate!)
        : null;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    event.displayName,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary, letterSpacing: -0.3),
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 20),
              ],
            ),
            if (event.title != event.displayName) ...[
              const SizedBox(height: 2),
              Text(event.title, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 6,
              children: [
                _chip(Icons.people_outline_rounded, '${event.guestCount} guests'),
                if (dateStr != null) _chip(Icons.calendar_today_outlined, dateStr),
                if (event.venue != null) _chip(Icons.location_on_outlined, event.venue!),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip(IconData icon, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: AppColors.textSecondary),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
      ],
    );
  }
}
