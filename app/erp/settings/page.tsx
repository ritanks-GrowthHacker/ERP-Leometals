'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { useTheme } from '@/lib/contexts/ThemeContext';
import { getAuthToken } from '@/lib/utils/token';
import { useAlert } from '@/components/common/CustomAlert';
import { Moon, Sun, User, Upload } from 'lucide-react';

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const { showAlert } = useAlert();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    departmentName: user?.departmentName || '',
    organizationName: user?.organizationName || '',
    roleName: '',
    profilePicture: user?.profilePicture || null,
  });

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = getAuthToken();
        const response = await fetch('/api/erp/profile', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setUser(data.user);
            
            // Determine which role to display (department role takes priority)
            const displayRole = data.user.departmentRole?.name || data.user.organizationRole?.name || 'No Role';
            
            setProfileData({
              name: data.user.name || '',
              email: data.user.email || '',
              phone: data.user.phone || '',
              departmentName: data.user.departmentName || '',
              organizationName: data.user.organizationName || '',
              roleName: displayRole,
              profilePicture: data.user.profilePicture || null,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    if (user) {
      // Determine which role to display (department role takes priority)
      const displayRole = (user as any).departmentRole?.name || (user as any).organizationRole?.name || 'No Role';
      
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        departmentName: user.departmentName || '',
        organizationName: user.organizationName || '',
        roleName: displayRole,
        profilePicture: user.profilePicture || null,
      });
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = getAuthToken();
      const response = await fetch('/api/erp/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        showAlert({ type: 'success', title: 'Success', message: 'Profile updated successfully!' });
      } else {
        showAlert({ type: 'error', title: 'Error', message: data.error || 'Failed to update profile' });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showAlert({ type: 'error', title: 'Error', message: 'File size must be less than 2MB' });
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      showAlert({ type: 'error', title: 'Error', message: 'Please upload an image file' });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const token = getAuthToken();
      const response = await fetch('/api/erp/profile/picture', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        if (user?.id) {
          setUser({ ...user, profilePicture: data.profilePicture });
        }
        setProfileData({ ...profileData, profilePicture: data.profilePicture });
        showAlert({ type: 'success', title: 'Success', message: 'Profile picture updated!' });
      } else {
        showAlert({ type: 'error', title: 'Error', message: data.error || 'Failed to upload picture' });
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to upload picture' });
    } finally {
      setUploading(false);
    }
  };

  const getUserInitials = () => {
    if (!profileData.name) return 'U';
    const names = profileData.name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return profileData.name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="p-6 dark:bg-gray-900 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {user?.isApiUser ? 'API User Profile (Read-only)' : 'Manage your account preferences'}
          </p>
        </div>

        {/* API User Notice */}
        {user?.isApiUser && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">API User Account</h3>
                <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
                  This is an API user account. Profile settings are read-only and cannot be modified through the UI.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'profile'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <User className="inline-block w-4 h-4 mr-2" />
                Profile
              </button>
              <button
                onClick={() => setActiveTab('appearance')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'appearance'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                {theme === 'dark' ? <Moon className="inline-block w-4 h-4 mr-2" /> : <Sun className="inline-block w-4 h-4 mr-2" />}
                Appearance
              </button>
            </nav>
          </div>

          <div className="p-8">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-8">
                {/* Profile Picture Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Picture</h3>
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      {profileData.profilePicture ? (
                        <img
                          src={profileData.profilePicture}
                          alt="Profile"
                          className="w-24 h-24 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <span className="text-white text-2xl font-semibold">{getUserInitials()}</span>
                        </div>
                      )}
                      {uploading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className={`inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors ${
                        user?.isApiUser 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}>
                        <Upload className="w-4 h-4" />
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePictureUpload}
                          className="hidden"
                          disabled={uploading || user?.isApiUser}
                        />
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {user?.isApiUser ? 'Profile picture upload disabled for API users' : 'JPG, PNG or GIF. Max size 2MB.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Profile Form */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h3>
                  <form onSubmit={handleProfileUpdate} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={profileData.name}
                          onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
                          required
                          disabled={user?.isApiUser}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={profileData.email}
                          onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
                          required
                          disabled={user?.isApiUser}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={profileData.phone}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
                          disabled={user?.isApiUser}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {user?.isApiUser ? 'Account Type' : 'Department'}
                        </label>
                        <input
                          type="text"
                          value={profileData.departmentName}
                          disabled
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Organization
                        </label>
                        <input
                          type="text"
                          value={profileData.organizationName}
                          disabled
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Role
                        </label>
                        <input
                          type="text"
                          value={profileData.roleName}
                          disabled
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        />
                      </div>
                    </div>

                    {!user?.isApiUser && (
                      <div className="flex justify-end pt-4">
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                        >
                          {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Theme</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Choose how the ERP system looks to you. Select a single theme, or sync with your system and automatically switch between day and night themes.
                  </p>

                  <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center gap-4">
                      {theme === 'dark' ? (
                        <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {theme === 'dark' ? 'Dark theme is active' : 'Light theme is active'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}