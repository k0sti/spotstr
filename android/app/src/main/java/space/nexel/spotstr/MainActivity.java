package space.nexel.spotstr;

import android.os.Bundle;
import android.util.Log;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "Spotstr";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Log.d(TAG, "MainActivity onCreate - Enabling edge-to-edge");

        // Enable edge-to-edge display for Android 15+ compliance
        // The SafeArea plugin will handle the actual insets
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        Log.d(TAG, "MainActivity onCreate complete");
    }
}
