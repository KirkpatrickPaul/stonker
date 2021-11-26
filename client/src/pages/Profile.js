import React, { useEffect, useState } from 'react';
import BlogContainer from '../components/BlogContainer/BlogContainer';
import { getUserInfo } from '../utils/API';
import { useParams } from 'react-router-dom';
import { useUserProvider } from '../utils/UserProvider';
import UserSettings from '../components/UserSettings/UserSettings';
import LoginForm from '../components/LoginForm/LoginForm';

function Profile() {
  const { user, setUser } = useUserProvider();
  const [userInfo, setUserInfo] = useState({
    email: '',
    username: '',
    Comments: []
  });

  const { id } = user;
  useEffect(async () => {
    try {
      const res = await getUserInfo(id);
      console.log('getUserInfo');
      const userData = res?.data?.[0];
      if (userData) {
        console.log(userData);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  if (user.id) {
    return (
      <UserSettings
        userInfo={userInfo}
        setUserInfo={setUserInfo}
      ></UserSettings>
    );
  } else {
    return <LoginForm />;
  }
}

export default Profile;
