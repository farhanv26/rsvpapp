import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/guest.dart';
import '../../core/services/guests_service.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/utils/error_message.dart';

class GuestEditScreen extends ConsumerStatefulWidget {
  const GuestEditScreen({
    super.key,
    required this.eventId,
    required this.guest,
  });

  final String eventId;
  final Guest? guest;

  @override
  ConsumerState<GuestEditScreen> createState() => _GuestEditScreenState();
}

class _GuestEditScreenState extends ConsumerState<GuestEditScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final TextEditingController _phoneCode;
  late final TextEditingController _email;
  late final TextEditingController _group;
  late final TextEditingController _table;
  late final TextEditingController _notes;
  late int _men;
  late int _women;
  late int _kids;
  bool _saving = false;
  String? _error;

  bool get _isEditing => widget.guest != null;

  @override
  void initState() {
    super.initState();
    final g = widget.guest;
    _name = TextEditingController(text: g?.guestName ?? '');
    _phone = TextEditingController(text: g?.phone ?? '');
    _phoneCode = TextEditingController(text: g?.phoneCountryCode ?? '');
    _email = TextEditingController(text: g?.email ?? '');
    _group = TextEditingController(text: g?.group ?? '');
    _table = TextEditingController(text: g?.tableName ?? '');
    _notes = TextEditingController(text: g?.notes ?? '');
    _men = g?.menCount ?? 0;
    _women = g?.womenCount ?? 0;
    _kids = g?.kidsCount ?? 0;
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _phoneCode, _email, _group, _table, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final party = _men + _women + _kids;
    if (party <= 0) {
      setState(() => _error = 'Add at least one person (men, women, or kids).');
      return;
    }
    setState(() { _saving = true; _error = null; });

    final data = <String, dynamic>{
      'guestName': _name.text.trim(),
      'menCount': _men,
      'womenCount': _women,
      'kidsCount': _kids,
      'maxGuests': party,
      if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
      if (_phoneCode.text.trim().isNotEmpty) 'phoneCountryCode': _phoneCode.text.trim(),
      if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
      if (_group.text.trim().isNotEmpty) 'group': _group.text.trim(),
      if (_table.text.trim().isNotEmpty) 'tableName': _table.text.trim(),
      if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
    };

    try {
      final service = ref.read(guestsServiceProvider);
      if (_isEditing) {
        await service.updateGuest(widget.eventId, widget.guest!.id, data);
      } else {
        await service.createGuest(widget.eventId, data);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _error = userFacingErrorMessage(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final initial = widget.guest?.guestName.isNotEmpty == true
        ? widget.guest!.guestName[0].toUpperCase()
        : null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: Text(
          _isEditing ? 'Edit guest' : 'Add guest',
          style: AppTextStyles.titleMedium,
        ),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandAccent),
                  )
                : const Text(
                    'Save',
                    style: TextStyle(
                      color: AppColors.brandAccent,
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 48),
          children: [
            // Avatar header
            if (_isEditing && initial != null) ...[
              Center(
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppColors.brandDeep,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Center(
                    child: Text(
                      initial,
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textInverse,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.dangerBg,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            _label('Name'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                hintText: 'Guest name',
                prefixIcon: Icon(Icons.person_outline_rounded, size: 20),
              ),
              validator: (v) => v == null || v.trim().isEmpty ? 'Name is required' : null,
            ),
            const SizedBox(height: 20),

            _label('Guest count'),
            const SizedBox(height: 8),
            _CountCard(
              men: _men,
              women: _women,
              kids: _kids,
              onChanged: (m, w, k) => setState(() { _men = m; _women = w; _kids = k; }),
            ),
            const SizedBox(height: 20),

            _label('Contact'),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 88,
                  child: TextFormField(
                    controller: _phoneCode,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(hintText: '+1', labelText: 'Code'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextFormField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      hintText: 'Phone number',
                      prefixIcon: Icon(Icons.phone_outlined, size: 20),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                hintText: 'Email address',
                prefixIcon: Icon(Icons.email_outlined, size: 20),
              ),
            ),
            const SizedBox(height: 20),

            _label('Organisation'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _group,
              decoration: const InputDecoration(
                hintText: 'Group / category',
                prefixIcon: Icon(Icons.label_outline_rounded, size: 20),
              ),
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _table,
              decoration: const InputDecoration(
                hintText: 'Table name',
                prefixIcon: Icon(Icons.table_restaurant_outlined, size: 20),
              ),
            ),
            const SizedBox(height: 20),

            _label('Notes'),
            const SizedBox(height: 8),
            TextFormField(
              controller: _notes,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Internal notes…',
                alignLabelWithHint: true,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Text(text.toUpperCase(), style: AppTextStyles.sectionLabel);
}

class _CountCard extends StatelessWidget {
  const _CountCard({
    required this.men,
    required this.women,
    required this.kids,
    required this.onChanged,
  });
  final int men;
  final int women;
  final int kids;
  final void Function(int, int, int) onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          _CountRow(
            icon: Icons.man_rounded,
            label: 'Men',
            value: men,
            onDec: men > 0 ? () => onChanged(men - 1, women, kids) : null,
            onInc: () => onChanged(men + 1, women, kids),
          ),
          const Divider(height: 1, color: AppColors.borderLight),
          _CountRow(
            icon: Icons.woman_rounded,
            label: 'Women',
            value: women,
            onDec: women > 0 ? () => onChanged(men, women - 1, kids) : null,
            onInc: () => onChanged(men, women + 1, kids),
          ),
          const Divider(height: 1, color: AppColors.borderLight),
          _CountRow(
            icon: Icons.child_care_rounded,
            label: 'Kids',
            value: kids,
            onDec: kids > 0 ? () => onChanged(men, women, kids - 1) : null,
            onInc: () => onChanged(men, women, kids + 1),
          ),
        ],
      ),
    );
  }
}

class _CountRow extends StatelessWidget {
  const _CountRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.onInc,
    this.onDec,
  });
  final IconData icon;
  final String label;
  final int value;
  final VoidCallback onInc;
  final VoidCallback? onDec;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.textSecondary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary)),
          ),
          _StepBtn(icon: Icons.remove, onTap: onDec),
          SizedBox(
            width: 36,
            child: Text(
              '$value',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          _StepBtn(icon: Icons.add, onTap: onInc),
        ],
      ),
    );
  }
}

class _StepBtn extends StatelessWidget {
  const _StepBtn({required this.icon, this.onTap});
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: enabled ? AppColors.brandDeep : AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          icon,
          size: 16,
          color: enabled ? AppColors.textInverse : AppColors.textMuted,
        ),
      ),
    );
  }
}
