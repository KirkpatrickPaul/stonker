import React, { useEffect, useState } from 'react';
import BlogContainer from '../components/BlogContainer/BlogContainer';
import { getUserInfo } from '../utils/API';
import { useParams } from 'react-router-dom';
import { useUserProvider } from '../utils/UserProvider';
import UserSettings from '../components/UserSettings/UserSettings'
import LoginForm from '../components/LoginForm/LoginForm';

function Profile() {
  const { user, setUser } = useUserProvider();

  if (user.id) {
    return (
      <UserSettings>
      </UserSettings>
    );
  } else {
    return <LoginForm />;
  }
}

export default Profile;