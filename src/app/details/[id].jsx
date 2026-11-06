import { useLocalSearchParams } from "expo-router";
import TransactionDetailsScreen from "../../screens/TransactionDetailsScreen";

export default function DetailsRoute() {
  const { id } = useLocalSearchParams();

  return <TransactionDetailsScreen id={id} />;
}
