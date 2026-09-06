import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { AshaWorkerProfile } from '../services/authService';

export const ALL_ALUVA_WARDS = [
  'വാർഡ് 1, ആലുവ (Ward 1, Aluva)',
  'വാർഡ് 2, ആലുവ (Ward 2, Aluva)',
  'വാർഡ് 3, ആലുവ (Ward 3, Aluva)',
  'വാർഡ് 4, ആലുവ (Ward 4, Aluva)',
  'വാർഡ് 5, ആലുവ (Ward 5, Aluva)',
  'വാർഡ് 6, ആലുവ (Ward 6, Aluva)',
  'വാർഡ് 7, ആലുവ (Ward 7, Aluva)',
  'വാർഡ് 8, ആലുവ (Ward 8, Aluva)',
  'വാർഡ് 9, ആലുവ (Ward 9, Aluva)',
  'വാർഡ് 10, ആലുവ (Ward 10, Aluva)'
];

interface AshaProfileScreenProps {
  currentUser: AshaWorkerProfile | null;
  activeWard: string;
  onUpdateWard: (ward: string) => void;
  onLogout: () => void;
  onBack?: () => void;
}

export const AshaProfileScreen: React.FC<AshaProfileScreenProps> = ({
  currentUser,
  activeWard,
  onUpdateWard,
  onLogout,
  onBack
}) => {
  const [showWardModal, setShowWardModal] = useState<boolean>(false);

  const workerName = currentUser?.name || 'അനിത നായർ (Anitha Nair)';
  const workerRole = 'ആശാ പ്രവർത്തക (ASHA Worker)';
  const workerId = currentUser?.worker_id || 'ASHA-KL-EKM-042';
  const subCentre = currentUser?.sub_centre || 'കീഴ്മാട് സബ് സെന്റർ (Keezhmad SC)';
  const phone = currentUser?.phone || '+91 94471 23456';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Top Bar with Optional Back & Page Title */}
        <View style={styles.topBar}>
          {onBack && (
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
              <Text style={styles.backBtnText}>← സർവേ (Back)</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>ആശാ പ്രൊഫൈൽ</Text>
            <Text style={styles.pageSubtitle}>ASHA Professional Profile & Ward Coverage</Text>
          </View>
        </View>

        {/* Hero Card: Healthcare Worker Identification */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['#042F2E', '#0D9488']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.avatarRing}>
              {/* Doctor / Healthcare Worker Silhouette SVG */}
              <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="7" r="4" fill="#5EEAD4" />
                <Path
                  d="M4 21v-2a6 6 0 0112 0v2"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                {/* Cross symbol badge */}
                <Path d="M18 10h4M20 8v4" stroke="#5EEAD4" strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </View>
            <View style={styles.heroTextCol}>
              <Text style={styles.workerNameText}>{workerName}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{workerRole}</Text>
              </View>
              <Text style={styles.idSubtext}>ID: {workerId} • ആലുവ PHC</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Ward & Sub-Centre Assignment Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>നിയോഗിക്കപ്പെട്ട വാർഡും സബ് സെന്ററും</Text>
            <Text style={styles.sectionSubtitle}>Primary Field Jurisdiction & Health Ward</Text>
          </View>

          {/* Active Ward Dropdown Selector */}
          <View style={styles.wardSelectorRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>നിലവിലെ വാർഡ് (Active Ward):</Text>
              <Text style={styles.activeWardDisplay}>{activeWard}</Text>
            </View>
            <TouchableOpacity
              style={styles.changeWardBtn}
              onPress={() => setShowWardModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.changeWardBtnText}>മാറ്റുക ▾</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Sub Centre & Contact Info */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>സബ് സെന്റർ (Sub-Centre):</Text>
            <Text style={styles.detailValue}>{subCentre}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>താലൂക്ക് ആശുപത്രി (Hospital):</Text>
            <Text style={styles.detailValue}>ആലുവ ഗവ. താലൂക്ക് ആശുപത്രി</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ഫോൺ (Mobile):</Text>
            <Text style={styles.detailValue}>{phone}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ഇമെയിൽ (Official):</Text>
            <Text style={styles.detailValue}>anitha.asha.aluva@keralahealth.gov.in</Text>
          </View>
        </View>

        {/* Field Coverage & Activity Metrics Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ഫീൽഡ് കവറേജ് സ്ഥിതിവിവരങ്ങൾ</Text>
            <Text style={styles.sectionSubtitle}>Ward Level Health Metrics & Care Targets</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>42</Text>
              <Text style={styles.statLabel}>വീടുകൾ{"\n"}(Households)</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>168</Text>
              <Text style={styles.statLabel}>ഗുണഭോക്താക്കൾ{"\n"}(Citizens)</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>28</Text>
              <Text style={styles.statLabel}>ഈ മാസത്തെ വിസിറ്റ്{"\n"}(Visits)</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#D97706' }]}>4</Text>
              <Text style={styles.statLabel}>ശ്രദ്ധ ആവശ്യമുള്ളവ{"\n"}(Care Gaps)</Text>
            </View>
          </View>
        </View>

        {/* Professional Certifications & Training Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>യോഗ്യതകളും പരിശീലനങ്ങളും</Text>
            <Text style={styles.sectionSubtitle}>Accreditations & Healthcare Capabilities</Text>
          </View>

          <View style={styles.certList}>
            <View style={styles.certItem}>
              <View style={styles.certDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.certTitle}>National Health Mission (NHM) കേരള</Text>
                <Text style={styles.certDesc}>അംഗീകൃത ഫ്രണ്ട്‌ലൈൻ ആരോഗ്യ പ്രവർത്തക സർട്ടിഫിക്കേഷൻ</Text>
              </View>
            </View>

            <View style={styles.certItem}>
              <View style={styles.certDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.certTitle}>CBAC / NCD സ്ക്രീനിംഗ് പരിശീലനം</Text>
                <Text style={styles.certDesc}>ജീവിതശൈലീ രോഗനിർണയവും കാൻസർ മുൻകരുതൽ പരിശോധനയും</Text>
              </View>
            </View>

            <View style={styles.certItem}>
              <View style={styles.certDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.certTitle}>ശിശു പോഷകാഹാര വളർച്ചാ ചാർട്ട് (WHO WAZ)</Text>
                <Text style={styles.certDesc}>കുട്ടികളിലെ ഭാരം, വളർച്ചാ നിർണയം, SAM/MAM സ്ക്രീനിംഗ്</Text>
              </View>
            </View>

            <View style={styles.certItem}>
              <View style={styles.certDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.certTitle}>മാനസികാരോഗ്യ പ്രാഥമിക സർവേ (PHQ-4)</Text>
                <Text style={styles.certDesc}>സമൂഹതല മാനസികാരോഗ്യ നിരീക്ഷണവും കൗൺസിലിംഗ് റഫറലും</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Emergency & Support Contacts Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>അടിയന്തര സഹായ നമ്പറുകൾ</Text>
            <Text style={styles.sectionSubtitle}>Primary Health Team & Support Helplines</Text>
          </View>

          <View style={styles.contactRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactName}>ശ്രീമതി. ഗീത (JPHN)</Text>
              <Text style={styles.contactRole}>ജൂനിയർ പബ്ലിക് ഹെൽത്ത് നേഴ്സ്, ആലുവ</Text>
            </View>
            <Text style={styles.contactPhone}>+91 98460 11223</Text>
          </View>

          <View style={styles.contactRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactName}>ഡോ. രാഹുൽ മേനോൻ</Text>
              <Text style={styles.contactRole}>മെഡിക്കൽ ഓഫീസർ, PHC ആലുവ</Text>
            </View>
            <Text style={styles.contactPhone}>+91 94470 55667</Text>
          </View>

          <View style={[styles.contactRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactName}>ദിശ 1056 (DISHA)</Text>
              <Text style={styles.contactRole}>ആരോഗ്യ വകുപ്പ് 24 മണിക്കൂർ ടോൾ ഫ്രീ ഹെൽപ്പ് ലൈൻ</Text>
            </View>
            <Text style={[styles.contactPhone, { color: '#0D9488' }]}>1056</Text>
          </View>
        </View>

        {/* Central Database Connectivity Card */}
        <View style={[styles.sectionCard, { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={[styles.sectionTitle, { color: '#166534' }]}>കേന്ദ്ര ഡാറ്റാബേസ് കണക്ഷൻ</Text>
              <Text style={[styles.sectionSubtitle, { color: '#15803D' }]}>MongoDB Atlas Cloud Cluster Active</Text>
            </View>
            <View style={styles.dbStatusPill}>
              <Text style={styles.dbStatusText}>✓ കണക്ടഡ്</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout} activeOpacity={0.8}>
          <Text style={styles.logoutButtonText}>ലോഗൗട്ട് (Logout from Swaram)</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Ward Selection Modal (10 Wards) */}
      <Modal
        visible={showWardModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWardModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>വാർഡ് തിരഞ്ഞെടുക്കുക</Text>
                <Text style={styles.modalSubtitle}>Select Primary Health Ward (Aluva Municipality)</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowWardModal(false)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {ALL_ALUVA_WARDS.map((w, idx) => {
                const isSelected = activeWard === w;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.wardOption, isSelected && styles.wardOptionSelected]}
                    onPress={() => {
                      onUpdateWard(w);
                      setShowWardModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.wardOptionText, isSelected && styles.wardOptionTextSelected]}>
                      {w}
                    </Text>
                    {isSelected && <Text style={styles.wardCheckmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 60
  },
  topBar: {
    marginBottom: 16
  },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8
  },
  backBtnText: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '700'
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
    letterSpacing: -0.3
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  heroCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#0D9488',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8
      },
      android: {
        elevation: 4
      },
      web: {
        boxShadow: '0 4px 16px rgba(13, 148, 136, 0.2)'
      }
    })
  },
  heroGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16
  },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#5EEAD4',
    marginRight: 14
  },
  heroTextCol: {
    flex: 1
  },
  workerNameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  roleBadge: {
    backgroundColor: '#5EEAD4',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#042F2E'
  },
  idSubtext: {
    fontSize: 11,
    color: '#CCFBF1',
    marginTop: 4
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6
      },
      android: {
        elevation: 2
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
      }
    })
  },
  sectionHeader: {
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A'
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },
  wardSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  fieldLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600'
  },
  activeWardDisplay: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0D9488',
    marginTop: 2
  },
  changeWardBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  changeWardBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold'
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B'
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    maxWidth: '55%',
    textAlign: 'right'
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0D9488'
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 3,
    lineHeight: 13
  },
  certList: {
    gap: 10
  },
  certItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
  },
  certDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0D9488',
    marginTop: 5
  },
  certTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A'
  },
  certDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  contactName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B'
  },
  contactRole: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },
  contactPhone: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0284C7'
  },
  dbStatusPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  dbStatusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#166534'
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6
  },
  logoutButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    padding: 18,
    elevation: 6
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A'
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  modalCloseBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  modalCloseBtnText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: 'bold'
  },
  wardOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 2
  },
  wardOptionSelected: {
    backgroundColor: '#F0FDFA'
  },
  wardOptionText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500'
  },
  wardOptionTextSelected: {
    color: '#0D9488',
    fontWeight: '700'
  },
  wardCheckmark: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0D9488'
  }
});
