import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    this.sub,
    this.color,
    this.icon,
    this.progress,
  });

  final String label;
  final String value;
  final String? sub;
  final Color? color;
  final IconData? icon;
  final double? progress;

  @override
  Widget build(BuildContext context) {
    final valueColor = color ?? AppColors.textPrimary;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 16, color: valueColor.withValues(alpha: 0.5)),
                    const SizedBox(height: 6),
                  ],
                  Text(
                    value,
                    style: AppTextStyles.statValue.copyWith(color: valueColor),
                  ),
                  const SizedBox(height: 4),
                  Text(label.toUpperCase(), style: AppTextStyles.statLabel),
                  if (sub != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      sub!,
                      style: const TextStyle(fontSize: 10, color: AppColors.textMuted, height: 1.3),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (progress != null)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(AppRadius.md)),
              child: SizedBox(
                height: 3,
                child: LinearProgressIndicator(
                  value: progress!.clamp(0.0, 1.0),
                  backgroundColor: valueColor.withValues(alpha: 0.08),
                  valueColor: AlwaysStoppedAnimation(valueColor.withValues(alpha: 0.6)),
                ),
              ),
            )
          else
            const SizedBox(height: 12),
        ],
      ),
    );
  }
}

class StatRow extends StatelessWidget {
  const StatRow({
    super.key,
    required this.label,
    required this.value,
    this.highlight = false,
    this.valueColor,
  });

  final String label;
  final String value;
  final bool highlight;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: valueColor ?? (highlight ? AppColors.brandAccent : AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

class SectionStatRow extends StatelessWidget {
  const SectionStatRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textSecondary;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: c.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 15, color: c),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 13.5, color: AppColors.textSecondary),
            ),
          ),
          Text(
            value,
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c),
          ),
        ],
      ),
    );
  }
}
