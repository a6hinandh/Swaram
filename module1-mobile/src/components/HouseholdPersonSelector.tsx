import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { HouseholdSummary, HouseholdMember } from '../types';

interface HouseholdPersonSelectorProps {
  households: HouseholdSummary[];
  selectedHousehold: HouseholdSummary | null;
  onSelectHousehold: (household: HouseholdSummary) => void;
  members: HouseholdMember[];
  selectedPerson: HouseholdMember | null;
  onSelectPerson: (person: HouseholdMember) => void;
  isLoadingMembers?: boolean;
  onAddNewMember?: (member: Partial<HouseholdMember>) => Promise<void>;
  onAddNewHousehold?: (hh: Partial<HouseholdSummary>) => Promise<void>;
}

export const HouseholdPersonSelector: React.FC<HouseholdPersonSelectorProps> = ({
  households,
  selectedHousehold,
  onSelectHousehold,
  members,
  selectedPerson,
  onSelectPerson,
  isLoadingMembers = false,
  onAddNewMember,
  onAddNewHousehold
}) => {
  const [showHhModal, setShowHhModal] = useState<boolean>(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);
  const [showAddHhModal, setShowAddHhModal] = useState<boolean>(false);

  // New Member Form State
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberAge, setNewMemberAge] = useState<string>('');
  const [newMemberGender, setNewMemberGender] = useState<string>('female');
  const [newMemberRelation, setNewMemberRelation] = useState<string>('member');
  const [newMemberConditions, setNewMemberConditions] = useState<string>('');
  const [isSubmittingMember, setIsSubmittingMember] = useState<boolean>(false);

  // New Household Form State
  const [newHhNumber, setNewHhNumber] = useState<string>('');
  const [newHhHead, setNewHhHead] = useState<string>('');
  const [newHhHeadAge, setNewHhHeadAge] = useState<string>('');
  const [newHhHeadGender, setNewHhHeadGender] = useState<string>('female');
  const [newHhHeadConditions, setNewHhHeadConditions] = useState<string>('');
  const [newHhAddress, setNewHhAddress] = useState<string>('');
  const [isSubmittingHh, setIsSubmittingHh] = useState<boolean>(false);

  const handleAddMemberSubmit = async () => {
    if (!newMemberName.trim()) return;
    setIsSubmittingMember(true);
    try {
      if (onAddNewMember) {
        await onAddNewMember({
          name: newMemberName.trim(),
          age: newMemberAge ? parseFloat(newMemberAge) : undefined,
          gender: newMemberGender,
          relationship: newMemberRelation,
          chronic_conditions: newMemberConditions
            ? newMemberConditions.split(',').map((c) => c.trim()).filter(Boolean)
            : []
        });
      }
      setNewMemberName('');
      setNewMemberAge('');
      setNewMemberConditions('');
      setShowAddMemberModal(false);
    } finally {
      setIsSubmittingMember(false);
    }
  };

  const handleAddHhSubmit = async () => {
    if (!newHhHead.trim() || !newHhNumber.trim()) return;
    setIsSubmittingHh(true);
    try {
      if (onAddNewHousehold) {
        await onAddNewHousehold({
          external_id: newHhNumber.trim().toUpperCase(),
          head_of_household: newHhHead.trim(),
          address: newHhAddress.trim() || 'Ward 4, Aluva',
          members_count: 1,
          head_details: {
            age: newHhHeadAge ? parseFloat(newHhHeadAge) : undefined,
            gender: newHhHeadGender,
            relationship: 'head',
            chronic_conditions: newHhHeadConditions
              ? newHhHeadConditions.split(',').map((c) => c.trim()).filter(Boolean)
              : []
          }
        } as any);
      }
      setNewHhNumber('');
      setNewHhHead('');
      setNewHhHeadAge('');
      setNewHhHeadConditions('');
      setNewHhAddress('');
      setShowAddHhModal(false);
    } finally {
      setIsSubmittingHh(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Active Household Header Bar */}
      <View style={styles.hhHeaderRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.tagRow}>
            <Text style={styles.sectionLabel}>സന്ദർശിക്കുന്ന വീട്</Text>
          </View>

          {selectedHousehold ? (
            <View>
              <Text style={styles.hhTitle}>
                <Text style={styles.hhNumber}>[{selectedHousehold.external_id || selectedHousehold.id}]</Text>{' '}
                {selectedHousehold.head_of_household}
              </Text>
              <Text style={styles.hhAddress} numberOfLines={1}>
                {selectedHousehold.address}
              </Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>ഒരു വീട് തിരഞ്ഞെടുക്കുക</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.switchHhBtn}
          onPress={() => setShowHhModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.switchHhBtnText}>മാറ്റുക ▾</Text>
        </TouchableOpacity>
      </View>

      {/* Citizen / Family Member Quick Bar */}
      <View style={styles.personSection}>
        <View style={styles.personLabelRow}>
          <Text style={styles.personSectionLabel}>
            ഗുണഭോക്താവ്:
          </Text>
          {isLoadingMembers && <ActivityIndicator size="small" color="#0D9488" />}
        </View>

        {/* Selected Person Card Highlight */}
        {selectedPerson && (
          <View style={styles.activePersonBanner}>
            <View style={styles.avatarPill}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="8" r="4" stroke="#0D9488" strokeWidth="2" />
                <Path d="M4 20v-2a6 6 0 0112 0v2" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.personNameRow}>
                <Text style={styles.activePersonName}>{selectedPerson.name}</Text>
                <Text style={styles.activePersonMeta}>
                  {selectedPerson.age !== undefined ? `${selectedPerson.age} വയസ്സ്` : ''} •{' '}
                  {selectedPerson.gender === 'female' ? 'സ്ത്രീ' : 'പുരുഷൻ'}
                </Text>
              </View>

              <View style={styles.conditionsRow}>
                {selectedPerson.relationship && (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>{selectedPerson.relationship}</Text>
                  </View>
                )}
                {selectedPerson.pregnancy_status === 'pregnant' && (
                  <View style={[styles.metaChip, { backgroundColor: '#FDF2F8', borderColor: '#FBCFE8' }]}>
                    <Text style={[styles.metaChipText, { color: '#9D174D' }]}>
                      ഗർഭിണി ({selectedPerson.pregnancy_weeks || 32} ആഴ്ച)
                    </Text>
                  </View>
                )}
                {selectedPerson.chronic_conditions && selectedPerson.chronic_conditions.map((cond, i) => (
                  <View key={i} style={[styles.metaChip, { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }]}>
                    <Text style={[styles.metaChipText, { color: '#334155' }]}>{cond}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Member Quick-Switch Scroll Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.memberChipsScroll}
        >
          {members.map((m) => {
            const isSelected = selectedPerson?.person_id === m.person_id;
            return (
              <TouchableOpacity
                key={m.person_id}
                style={[styles.memberChip, isSelected && styles.memberChipActive]}
                onPress={() => onSelectPerson(m)}
                activeOpacity={0.8}
              >
                <Text style={[styles.memberChipText, isSelected && styles.memberChipTextActive]}>
                  {m.name}
                  {m.age !== undefined ? ` (${m.age})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Add Member Button */}
          <TouchableOpacity
            style={styles.addMemberChip}
            onPress={() => setShowAddMemberModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.addMemberChipText}>+ അംഗത്തെ ചേർക്കുക</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ----------------- MODAL 1: SELECT HOUSEHOLD ----------------- */}
      <Modal
        visible={showHhModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHhModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>നമ്പർ ചെയ്ത വീടുകൾ</Text>
                <Text style={styles.modalSubtitle}>ഫീൽഡ് ലിസ്റ്റ് ({households.length} വീടുകൾ)</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowHhModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {households.map((hh) => {
                const isSelected = selectedHousehold?.id === hh.id;
                return (
                  <TouchableOpacity
                    key={hh.id}
                    style={[styles.hhCard, isSelected && styles.hhCardActive]}
                    onPress={() => {
                      onSelectHousehold(hh);
                      setShowHhModal(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.hhCardTop}>
                      <View style={styles.hhBadge}>
                        <Text style={styles.hhBadgeText}>{hh.external_id || hh.id}</Text>
                      </View>
                    </View>

                    <Text style={styles.hhHeadName}>{hh.head_of_household}</Text>
                    <Text style={styles.hhCardAddr}>{hh.address}</Text>

                    <View style={styles.hhStatsRow}>
                      <Text style={styles.hhStatItem}>{hh.members_count} അംഗങ്ങൾ</Text>
                      <Text style={styles.hhStatItem}>{hh.open_care_gaps} ഫോളോ-അപ്പ്</Text>
                      {hh.malnutrition_risk && (
                        <Text style={styles.hhStatItem}>പോഷകാഹാരം: {hh.malnutrition_risk}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.addHhActionBtn}
                onPress={() => {
                  setShowHhModal(false);
                  setShowAddHhModal(true);
                }}
              >
                <Text style={styles.addHhActionText}>+ പുതിയ വീട് ചേർക്കുക</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ----------------- MODAL 2: ADD MEMBER TO HOUSEHOLD ----------------- */}
      <Modal
        visible={showAddMemberModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>കുടുംബാംഗത്തെ ചേർക്കുക</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedHousehold?.head_of_household || 'കുടുംബം'}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAddMemberModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <Text style={styles.inputLabel}>പേര് *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="ഉദാ. രാധിക എം."
                placeholderTextColor="#94A3B8"
                value={newMemberName}
                onChangeText={setNewMemberName}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>പ്രായം</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="ഉദാ. 45"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={newMemberAge}
                    onChangeText={setNewMemberAge}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>ലിംഗം</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    <TouchableOpacity
                      style={[styles.genderBtn, newMemberGender === 'female' && styles.genderBtnActive]}
                      onPress={() => setNewMemberGender('female')}
                    >
                      <Text style={[styles.genderBtnText, newMemberGender === 'female' && styles.genderBtnTextActive]}>സ്ത്രീ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.genderBtn, newMemberGender === 'male' && styles.genderBtnActive]}
                      onPress={() => setNewMemberGender('male')}
                    >
                      <Text style={[styles.genderBtnText, newMemberGender === 'male' && styles.genderBtnTextActive]}>പുരുഷൻ</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={styles.inputLabel}>കുടുംബ ബന്ധം</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="ഉദാ. അമ്മ, കുട്ടി, ഭർത്താവ്"
                placeholderTextColor="#94A3B8"
                value={newMemberRelation}
                onChangeText={setNewMemberRelation}
              />

              <Text style={styles.inputLabel}>രോഗാവസ്ഥകൾ (കോമ ഉപയോഗിച്ച് വേർതിരിക്കുക)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="ഉദാ. പ്രമേഹം, രക്താതിമർദ്ദം"
                placeholderTextColor="#94A3B8"
                value={newMemberConditions}
                onChangeText={setNewMemberConditions}
              />

              <TouchableOpacity
                style={[styles.submitFormBtn, isSubmittingMember && styles.submitBtnDisabled]}
                onPress={handleAddMemberSubmit}
                disabled={isSubmittingMember || !newMemberName.trim()}
              >
                {isSubmittingMember ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitFormBtnText}>സേവ് ചെയ്യുക</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ----------------- MODAL 3: ADD NEW HOUSEHOLD ----------------- */}
      <Modal
        visible={showAddHhModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAddHhModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>പുതിയ വീട് രജിസ്റ്റർ ചെയ്യുക</Text>
                <Text style={styles.modalSubtitle}>നമ്പർ ചെയ്ത വീട്</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAddHhModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <Text style={styles.inputLabel}>വീട്ടു നമ്പർ / ID *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="ഉദാ. ASHA-WARD4-HH045"
                placeholderTextColor="#94A3B8"
                value={newHhNumber}
                onChangeText={setNewHhNumber}
              />

              <Text style={styles.inputLabel}>ഗൃഹനാഥൻ/നാഥ *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="ഉദാ. ബാലകൃഷ്ണൻ നായർ"
                placeholderTextColor="#94A3B8"
                value={newHhHead}
                onChangeText={setNewHhHead}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>പ്രായം</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="ഉദാ. 50"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={newHhHeadAge}
                    onChangeText={setNewHhHeadAge}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>ലിംഗം</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    <TouchableOpacity
                      style={[styles.genderBtn, newHhHeadGender === 'female' && styles.genderBtnActive]}
                      onPress={() => setNewHhHeadGender('female')}
                    >
                      <Text style={[styles.genderBtnText, newHhHeadGender === 'female' && styles.genderBtnTextActive]}>സ്ത്രീ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.genderBtn, newHhHeadGender === 'male' && styles.genderBtnActive]}
                      onPress={() => setNewHhHeadGender('male')}
                    >
                      <Text style={[styles.genderBtnText, newHhHeadGender === 'male' && styles.genderBtnTextActive]}>പുരുഷൻ</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={styles.inputLabel}>മേൽവിലാസം</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="ഉദാ. വീട് നമ്പർ 60, ആലുവ"
                placeholderTextColor="#94A3B8"
                value={newHhAddress}
                onChangeText={setNewHhAddress}
              />

              <Text style={styles.inputLabel}>രോഗാവസ്ഥകൾ (ഉണ്ടെങ്കിൽ)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="ഉദാ. രക്താതിമർദ്ദം, പ്രമേഹം"
                placeholderTextColor="#94A3B8"
                value={newHhHeadConditions}
                onChangeText={setNewHhHeadConditions}
              />

              <TouchableOpacity
                style={[styles.submitFormBtn, isSubmittingHh && styles.submitBtnDisabled]}
                onPress={handleAddHhSubmit}
                disabled={isSubmittingHh || !newHhHead.trim() || !newHhNumber.trim()}
              >
                {isSubmittingHh ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitFormBtnText}>വീട് സേവ് ചെയ്യുക</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderRadius: 0,
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 16,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3
      },
      android: {
        elevation: 1
      },
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
      }
    })
  },
  hhHeaderRow: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  hhTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2
  },
  hhNumber: {
    color: '#0D9488',
    fontWeight: '800'
  },
  hhAddress: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  pillHigh: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  priorityPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#DC2626'
  },
  switchHhBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8
  },
  switchHhBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 2
  },
  personSection: {
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  personLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  personSectionLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155'
  },
  activePersonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10
  },
  avatarPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  personNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  activePersonName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A'
  },
  activePersonMeta: {
    fontSize: 11,
    color: '#64748B'
  },
  conditionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4
  },
  metaChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  metaChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569'
  },
  memberChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2
  },
  memberChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  memberChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#0D9488'
  },
  memberChipText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600'
  },
  memberChipTextActive: {
    color: '#0D9488',
    fontWeight: '700'
  },
  addMemberChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  addMemberChipText: {
    fontSize: 11,
    color: '#0D9488',
    fontWeight: '700'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    padding: 16,
    elevation: 6
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6
  },
  closeBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: 'bold'
  },
  modalScroll: {
    marginTop: 6
  },
  hhCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  hhCardActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA'
  },
  hhCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  hhBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  hhBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0D9488'
  },
  hhHeadName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A'
  },
  hhCardAddr: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  hhStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  hhStatItem: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '500'
  },
  addHhActionBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10
  },
  addHhActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488'
  },
  formScroll: {
    marginTop: 6
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
    marginTop: 8,
    marginBottom: 4
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12.5,
    color: '#0F172A'
  },
  genderBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center'
  },
  genderBtnActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488'
  },
  genderBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569'
  },
  genderBtnTextActive: {
    color: '#FFFFFF'
  },
  submitFormBtn: {
    backgroundColor: '#0D9488',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10
  },
  submitBtnDisabled: {
    opacity: 0.6
  },
  submitFormBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: 'bold'
  }
});
