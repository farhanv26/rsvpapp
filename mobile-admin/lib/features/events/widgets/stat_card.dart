import 'package:flutter/material.dart';
import '../../../shared/theme/app_theme.dart';

class StatCard extends StatelessWidget {
  const StatCard({super.key, required this.label, required this.value, this.sub, this.color});

  final String label;
  final String value;
  final String? sub;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w700,
              color: color ?? AppColors.textPrimary,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
          if (sub != null) ...[
            const SizedBox(height: 2),
            Text(sub!, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ],
        ],
      ),
    );
  }
}

class StatRow extends StatelessWidget {
  const StatRow({super.key, required this.label, required this.value, this.highlight = false});

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary)),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: highlight ? AppColors.primary : AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
