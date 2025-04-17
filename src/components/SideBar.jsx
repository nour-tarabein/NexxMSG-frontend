import React from 'react';
import { ListGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const SideBar = () => {
  return (
    <div
      className="bg-light border"
      style={{ width: '250px', height: 'calc(100vh - 60px)' }}
    >
      <ListGroup variant="flush">
        <ListGroup.Item as={Link} to="/chat" action>
          General Chat
        </ListGroup.Item>
        <ListGroup.Item as={Link} to="/friends" action>
          Friends
        </ListGroup.Item>
        <ListGroup.Item as={Link} to="/settings" action>
          Settings
        </ListGroup.Item>
      </ListGroup>
    </div>
  );
};

export default SideBar;
