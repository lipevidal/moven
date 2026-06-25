import { View, StyleSheet } from 'react-native';

import ProfileAchievementsCard from './ProfileAchievementsCard';
import ProfileChallengeStatsCard from './ProfileChallengeStatsCard';
import ProfileStreakCard from './ProfileStreakCard';
import ProfileBadgesCard from './ProfileBadgesCard';
import ProfileChallengeHistory from './ProfileChallengeHistory';

type ProfileCompetitionSectionProps = {
  userId: string;
  showHistory?: boolean;
};

export default function ProfileCompetitionSection({
  userId,
  showHistory = true,
}: ProfileCompetitionSectionProps) {
  return (
    <View style={styles.container}>
      <ProfileAchievementsCard userId={userId} />
      
      <ProfileChallengeStatsCard userId={userId} />

      <ProfileStreakCard userId={userId} />

      <ProfileBadgesCard userId={userId} />

      {showHistory && (
        <ProfileChallengeHistory userId={userId} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 16,
  },
});
