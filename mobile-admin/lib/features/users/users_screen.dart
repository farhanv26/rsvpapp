import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/models/admin_user.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/users_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/utils/error_message.dart';
import '../../shared/widgets/empty_state.dart';

class UsersScreen extends ConsumerWidget {
  const UsersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usersAsync = ref.watch(managedUsersProvider);
    final currentUser = ref.watch(currentUserProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 16, 12),
              child: Row(
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Users', style: AppTextStyles.titleLarge),
                        SizedBox(height: 2),
                        Text(
                          'Manage accounts & access',
                          style: TextStyle(fontSize: 13, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.person_add_rounded, size: 22),
                    color: AppColors.brandDeep,
                    tooltip: 'Add user',
                    onPressed: () => _showCreateSheet(context, ref),
                  ),
                ],
              ),
            ),
            Expanded(
              child: usersAsync.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(color: AppColors.brandAccent, strokeWidth: 2),
                ),
                error: (e, _) => ErrorView(
                  message: userFacingErrorMessage(e),
                  onRetry: () => ref.invalidate(managedUsersProvider),
                ),
                data: (users) {
                  if (users.isEmpty) {
                    return const EmptyState(
                      icon: Icons.people_outline_rounded,
                      title: 'No users',
                      subtitle: 'Tap + to create the first user.',
                    );
                  }
                  return RefreshIndicator(
                    color: AppColors.brandAccent,
                    backgroundColor: AppColors.surfaceCard,
                    onRefresh: () async => ref.invalidate(managedUsersProvider),
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 80),
                      itemCount: users.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => _UserCard(
                        user: users[i],
                        isSelf: currentUser?.id == users[i].id,
                        onChanged: () => ref.invalidate(managedUsersProvider),
                      ),
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

  void _showCreateSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CreateUserSheet(
        onCreated: () => ref.invalidate(managedUsersProvider),
      ),
    );
  }
}

// ── User card ──────────────────────────────────────────────────────

class _UserCard extends StatelessWidget {
  const _UserCard({
    required this.user,
    required this.isSelf,
    required this.onChanged,
  });
  final ManagedUser user;
  final bool isSelf;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final initial = user.name.isNotEmpty ? user.name[0].toUpperCase() : '?';
    final isSuperAdmin = user.isSuperAdmin;
    final isActive = user.active;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isActive ? AppColors.surfaceCard : AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: isActive ? AppColors.border : AppColors.border.withValues(alpha: 0.5)),
        boxShadow: isActive ? AppShadows.card : null,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: isSuperAdmin ? AppColors.brandDeep : AppColors.surfaceHighlight,
              borderRadius: BorderRadius.circular(13),
              border: Border.all(
                color: isSuperAdmin ? AppColors.brandAccent.withValues(alpha: 0.4) : AppColors.border,
              ),
            ),
            child: Center(
              child: Text(
                initial,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: isSuperAdmin ? AppColors.textInverse : AppColors.textSecondary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        user.name,
                        style: AppTextStyles.titleSmall.copyWith(
                          color: isActive ? AppColors.textPrimary : AppColors.textMuted,
                        ),
                      ),
                    ),
                    if (isSelf)
                      const _Pill('You', AppColors.brandAccent, AppColors.brandAccentLight),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    _Pill(
                      user.roleLabel,
                      isSuperAdmin ? AppColors.brandAccent : AppColors.textSecondary,
                      isSuperAdmin ? AppColors.brandAccentLight : AppColors.surfaceMuted,
                    ),
                    if (!isActive) const _Pill('Inactive', AppColors.danger, AppColors.dangerBg),
                    _Pill(
                      '${user.eventCount} event${user.eventCount == 1 ? '' : 's'}',
                      AppColors.textMuted,
                      AppColors.surfaceMuted,
                    ),
                    _Pill(
                      'Since ${DateFormat('MMM yyyy').format(user.createdAt)}',
                      AppColors.textMuted,
                      AppColors.surfaceMuted,
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (!isSelf) _UserMenu(user: user, onChanged: onChanged),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.label, this.fg, this.bg);
  final String label;
  final Color fg;
  final Color bg;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: fg.withValues(alpha: 0.2)),
        ),
        child: Text(
          label,
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: fg, letterSpacing: 0.2),
        ),
      );
}

// ── User actions menu ──────────────────────────────────────────────

class _UserMenu extends ConsumerWidget {
  const _UserMenu({required this.user, required this.onChanged});
  final ManagedUser user;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert_rounded, size: 20, color: AppColors.textMuted),
      color: AppColors.surfaceElevated,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        side: const BorderSide(color: AppColors.border),
      ),
      itemBuilder: (_) => [
        PopupMenuItem(
          value: 'role',
          child: _MenuItem(
            icon: Icons.swap_horiz_rounded,
            label: user.isSuperAdmin ? 'Change to Event Creator' : 'Change to Super Admin',
          ),
        ),
        PopupMenuItem(
          value: 'toggle_active',
          child: _MenuItem(
            icon: user.active ? Icons.block_rounded : Icons.check_circle_outline_rounded,
            label: user.active ? 'Deactivate' : 'Reactivate',
            danger: user.active,
          ),
        ),
        const PopupMenuItem(
          value: 'delete',
          child: _MenuItem(icon: Icons.delete_outline_rounded, label: 'Delete user', danger: true),
        ),
      ],
      onSelected: (v) async {
        final service = ref.read(usersServiceProvider);
        try {
          if (v == 'role') {
            final newRole = user.isSuperAdmin ? 'event_creator' : 'super_admin';
            await service.updateUser(user.id, {'role': newRole});
          } else if (v == 'toggle_active') {
            await service.updateUser(user.id, {'active': !user.active});
          } else if (v == 'delete') {
            if (!context.mounted) return;
            final confirmed = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Delete user?'),
                content: Text('Remove "${user.name}"? This cannot be undone.'),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    style: TextButton.styleFrom(foregroundColor: AppColors.danger),
                    child: const Text('Delete'),
                  ),
                ],
              ),
            );
            if (confirmed != true) return;
            await service.deleteUser(user.id);
          }
          onChanged();
        } catch (e) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(userFacingErrorMessage(e))),
            );
          }
        }
      },
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({required this.icon, required this.label, this.danger = false});
  final IconData icon;
  final String label;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? AppColors.danger : AppColors.textPrimary;
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 12),
        Text(label, style: TextStyle(fontSize: 14, color: color)),
      ],
    );
  }
}

// ── Create user sheet ──────────────────────────────────────────────

class _CreateUserSheet extends ConsumerStatefulWidget {
  const _CreateUserSheet({required this.onCreated});
  final VoidCallback onCreated;

  @override
  ConsumerState<_CreateUserSheet> createState() => _CreateUserSheetState();
}

class _CreateUserSheetState extends ConsumerState<_CreateUserSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  String _role = 'event_creator';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _saving = true; _error = null; });
    try {
      await ref.read(usersServiceProvider).createUser(
        name: _nameCtrl.text.trim(),
        password: _passCtrl.text.trim(),
        role: _role,
      );
      widget.onCreated();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() { _error = userFacingErrorMessage(e); _saving = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottom),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(AppRadius.xxl),
        border: Border.all(color: AppColors.border),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36, height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const Text('Add User', style: AppTextStyles.titleSmall),
            const SizedBox(height: 16),
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.dangerBg,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
                ),
                child: Text(_error!, style: const TextStyle(fontSize: 13, color: AppColors.danger)),
              ),
              const SizedBox(height: 12),
            ],
            TextFormField(
              controller: _nameCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Full name *', prefixIcon: Icon(Icons.person_outline_rounded, size: 20)),
              validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _passCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password *', prefixIcon: Icon(Icons.lock_outline_rounded, size: 20)),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Required';
                if (v.trim().length < 8) return 'At least 8 characters';
                return null;
              },
            ),
            const SizedBox(height: 16),
            const Text('ROLE', style: AppTextStyles.sectionLabel),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _RoleBtn(label: 'Event Creator', value: 'event_creator', selected: _role == 'event_creator', onTap: () => setState(() => _role = 'event_creator'))),
                const SizedBox(width: 10),
                Expanded(child: _RoleBtn(label: 'Super Admin', value: 'super_admin', selected: _role == 'super_admin', onTap: () => setState(() => _role = 'super_admin'))),
              ],
            ),
            const SizedBox(height: 20),
            GestureDetector(
              onTap: _saving ? null : _submit,
              child: AnimatedOpacity(
                opacity: _saving ? 0.6 : 1.0,
                duration: const Duration(milliseconds: 150),
                child: Container(
                  width: double.infinity,
                  height: 50,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [AppColors.brandAccentBright, AppColors.brandAccent], begin: Alignment.topLeft, end: Alignment.bottomRight),
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    boxShadow: AppShadows.button,
                  ),
                  child: Center(
                    child: _saving
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textOnAccent))
                        : const Text('Create User', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textOnAccent)),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoleBtn extends StatelessWidget {
  const _RoleBtn({required this.label, required this.value, required this.selected, required this.onTap});
  final String label;
  final String value;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected ? AppColors.brandAccentLight : AppColors.surfaceMuted,
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: selected ? AppColors.brandAccent : AppColors.border, width: selected ? 1.5 : 1),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected ? AppColors.brandDeep : AppColors.textSecondary,
              ),
            ),
          ),
        ),
      );
}
