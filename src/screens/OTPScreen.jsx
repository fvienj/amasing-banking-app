import NumericKeypad from "@/components/NumericKeypad";
import ScreenHeader from "@/components/ScreenHeader";
import { API_URL } from "@/config/api";
import { BankingContext } from "@/context/BankingContext";
import { router, useLocalSearchParams } from "expo-router";
import { MessageSquare, Zap } from "lucide-react-native";
import { useContext, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export default function OTPScreen() {
  const { user } = useContext(BankingContext);
  const insets = useSafeAreaInsets();
  const {
    mode = "login",
    phone = "",
    otp: initialOtp = "",
    otpRef: initialRef = "PA6Q",
  } = useLocalSearchParams();

  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(30);
  const [verifying, setVerifying] = useState(false);

  const [smsCode, setSmsCode] = useState(String(initialOtp));
  const [smsRef, setSmsRef] = useState(String(initialRef));
  const [bannerVisible, setBannerVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(-160)).current;
  const hideTimeoutRef = useRef(null);

  const isRegister = mode === "register";
  const displayPhone = phone
    ? `+63********${String(phone).slice(-4)}`
    : user.phone;

  const hideSmsBanner = () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    Animated.timing(slideAnim, {
      toValue: -160,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setBannerVisible(false));
  };

  const showSmsBanner = () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setBannerVisible(true);
    slideAnim.setValue(-160);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 6,
    }).start();

    hideTimeoutRef.current = setTimeout(() => {
      hideSmsBanner();
    }, 8000);
  };

  // Trigger simulated SMS arrival shortly after screen opens
  useEffect(() => {
    if (!initialOtp) return;
    const arriveTimer = setTimeout(() => {
      showSmsBanner();
    }, 450);

    return () => {
      clearTimeout(arriveTimer);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [initialOtp]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleKeyPress = (digit) => {
    if (otp.length >= 6 || verifying) return;
    setOtp((prev) => prev + digit);
  };

  const handleDelete = () => {
    if (verifying) return;
    setOtp((prev) => prev.slice(0, -1));
  };

  const handleAutofill = () => {
    if (smsCode) {
      setOtp(smsCode.slice(0, 6));
    }
    hideSmsBanner();
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      Alert.alert(
        "Incomplete OTP",
        "Please enter the 6-digit verification code.",
      );
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: String(phone),
          otp,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert(
          "Invalid OTP",
          data.detail || "The code you entered is incorrect.",
        );
        setOtp("");
        return;
      }

      hideSmsBanner();
      if (isRegister) {
        router.push({
          pathname: "/kyc",
          params: { phone: String(phone) },
        });
      } else {
        router.push("/passcode");
      }
    } catch (err) {
      Alert.alert(
        "Connection Error",
        "Could not verify OTP with the FastAPI server.",
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    if (timer > 0) return;

    try {
      const res = await fetch(`${API_URL}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: String(phone) }),
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert("Error", data.detail || "Could not resend OTP.");
        return;
      }

      setOtp("");
      setTimer(30);
      setSmsCode(String(data.otp));
      setSmsRef(String(data.otpRef));
      showSmsBanner();
    } catch (err) {
      Alert.alert(
        "Connection Error",
        "Could not reach the FastAPI server to resend OTP.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {bannerVisible && (
        <Animated.View
          style={[
            styles.smsWrapper,
            {
              top: insets.top + 8,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={handleAutofill}
            style={styles.smsBanner}
          >
            <View style={styles.smsIconBox}>
              <MessageSquare size={18} color="#FFFFFF" />
            </View>
            <View style={styles.smsContent}>
              <View style={styles.smsHeader}>
                <Text style={styles.smsSender}>MESSAGES • AMABank</Text>
                <Text style={styles.smsTime}>now</Text>
              </View>
              <Text style={styles.smsBody}>
                Your AMABank OTP is{" "}
                <Text style={styles.smsCode}>{smsCode}</Text> (Ref: {smsRef}).{" "}
                <Text style={styles.smsTapHint}>Tap to autofill</Text>
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      <ScreenHeader
        title="AMABank"
        rightIcon={<Zap size={20} color="#1A1A1A" fill="#1A1A1A" />}
        onRightPress={() => {
          if (smsCode) {
            showSmsBanner();
          } else {
            Alert.alert("OTP Info", "Tap 'Get a new OTP' to receive a code.");
          }
        }}
      />

      <View style={styles.subHeader}>
        {isRegister && (
          <Text style={styles.stepTag}>STEP 2 OF 3 • OTP VERIFICATION</Text>
        )}
        <Text style={styles.promptTitle}>Enter your OTP</Text>
        <Text style={styles.subtitle}>We sent it to {displayPhone}</Text>
        <Text style={styles.subtitle}>(Ref: {smsRef})</Text>
      </View>

      <View style={styles.slotsRow}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View key={index} style={styles.slot}>
            <Text style={styles.slotDigit}>{otp[index] || ""}</Text>
          </View>
        ))}
      </View>

      <NumericKeypad
        onKeyPress={handleKeyPress}
        onDelete={handleDelete}
        showConfirm
        confirmReady={otp.length === 6 && !verifying}
        onConfirm={handleVerifyOTP}
      />

      <TouchableOpacity
        style={styles.footerLink}
        disabled={timer > 0}
        onPress={handleResendOTP}
      >
        <Text style={[styles.coralLink, timer > 0 && styles.disabledLink]}>
          {timer > 0 ? `Get a new OTP (${timer}s)` : "Get a new OTP"}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    justifyContent: "space-between",
    paddingBottom: 24,
  },
  smsWrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
  },
  smsBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  smsIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#34A853",
    alignItems: "center",
    justifyContent: "center",
  },
  smsContent: {
    flex: 1,
    gap: 2,
  },
  smsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  smsSender: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A3A3A3",
    letterSpacing: 0.5,
  },
  smsTime: {
    fontSize: 11,
    color: "#737373",
  },
  smsBody: {
    fontSize: 13,
    color: "#F5F5F5",
    lineHeight: 18,
  },
  smsCode: {
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  smsTapHint: {
    color: "#DF5A56",
    fontWeight: "700",
  },
  subHeader: {
    alignItems: "center",
    gap: 4,
  },
  stepTag: {
    fontSize: 11,
    fontWeight: "700",
    color: "#737373",
    letterSpacing: 1,
    marginBottom: 4,
  },
  promptTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#DF5A56",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  slotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
  },
  slot: {
    width: 28,
    height: 36,
    borderBottomWidth: 2,
    borderBottomColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  slotDigit: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  footerLink: {
    alignItems: "center",
  },
  coralLink: {
    color: "#DF5A56",
    fontSize: 14,
    fontWeight: "600",
  },
  disabledLink: {
    opacity: 0.45,
  },
});
