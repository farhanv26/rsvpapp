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
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        splashColor: AppColors.brandAccent.withValues(alpha: 0.08),
        highlightColor: AppColors.brandAccent.withValues(alpha: 0.04),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: AppColors.border),
            boxShadow: AppShadows.card,
          ),
          child: Row(
            children: [
              // Brand accent strip
              Container(
                width: 3,
                height: 44,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [AppColors.brandAccent, AppColors.brandMid],
                  ),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 14),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      event.displayName,
                      style: AppTextStyles.titleSmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (event.coupleNames != null &&
                        event.coupleNames!.isNotEmpty &&
                        event.title != event.displayName) ...[
                      const SizedBox(height: 2),
                      Text(event.title,
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.textMuted)),
                    ],
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 10,
                      runSpacing: 4,
                      children: [
                        _MetaChip(
                          icon: Icons.people_outline_rounded,
                          label:
                              '${event.guestCount} guest${event.guestCount == 1 ? '' : 's'}',
                        ),
                        if (event.eventDate != null)
                          _MetaChip(
                            icon: Icons.calendar_today_outlined,
                            label: DateFormat('d MMM yyyy')
                                .format(event.eventDate!),
                          ),
                        if (event.venue != null)
                          _MetaChip(
                            icon: Icons.location_on_outlined,
                            label: event.venue!,
                          ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 8),
              const Icon(Icons.chevron_right_rounded,
                  color: AppColors.textMuted, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: AppColors.textMuted),
        const SizedBox(width: 3),
        Text(label,
            style: const TextStyle(
                fontSize: 12,
                color: AppColors.textMuted,
                fontWeight: FontWeight.w400)),
      ],
    );
  }
}
