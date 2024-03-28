/* eslint-disable react/prop-types */
import cx from "classnames";
import { Component } from "react";
import { connect } from "react-redux";
import { t, jt } from "ttag";
import _ from "underscore";

import { deleteAlert, unsubscribeFromAlert } from "metabase/alert/alert";
import Modal from "metabase/components/Modal";
import CS from "metabase/css/core/index.css";
import {
  AM_PM_OPTIONS,
  getDayOfWeekOptions,
  HOUR_OPTIONS,
} from "metabase/lib/date-time";
import {
  CreateAlertModalContent,
  UpdateAlertModalContent,
} from "metabase/query_builder/components/AlertModals";
import { getQuestionAlerts } from "metabase/query_builder/selectors";
import { getUser } from "metabase/selectors/user";
import { Icon } from "metabase/ui";

class AlertListPopoverContent extends Component {
  state = {
    adding: false,
    hasJustUnsubscribedFromOwnAlert: false,
  };

  onAdd = () => {
    this.props.setMenuFreeze(true);
    this.setState({ adding: true });
  };

  onEndAdding = (closeMenu = false) => {
    this.props.setMenuFreeze(false);
    this.setState({ adding: false });
    if (closeMenu) {
      this.props.closeMenu();
    }
  };

  isCreatedByCurrentUser = alert => {
    const { user } = this.props;
    return alert.creator.id === user.id;
  };

  onUnsubscribe = alert => {
    if (this.isCreatedByCurrentUser(alert)) {
      this.setState({ hasJustUnsubscribedFromOwnAlert: true });
    }
  };

  render() {
    const { questionAlerts, setMenuFreeze, user, closeMenu } = this.props;
    const { adding, hasJustUnsubscribedFromOwnAlert } = this.state;

    const isNonAdmin = !user.is_superuser;
    const [ownAlerts, othersAlerts] = _.partition(
      questionAlerts,
      this.isCreatedByCurrentUser,
    );
    // user's own alert should be shown first if it exists
    const sortedQuestionAlerts = [...ownAlerts, ...othersAlerts];
    const hasOwnAlerts = ownAlerts.length > 0;
    const hasOwnAndOthers = hasOwnAlerts && othersAlerts.length > 0;

    return (
      <div style={{ minWidth: 410 }}>
        <ul>
          {Object.values(sortedQuestionAlerts).map(alert => (
            <AlertListItem
              key={alert.id}
              alert={alert}
              setMenuFreeze={setMenuFreeze}
              closeMenu={closeMenu}
              highlight={
                isNonAdmin &&
                hasOwnAndOthers &&
                this.isCreatedByCurrentUser(alert)
              }
              onUnsubscribe={this.onUnsubscribe}
            />
          ))}
        </ul>
        {(!hasOwnAlerts || hasJustUnsubscribedFromOwnAlert) && (
          <div className={cx(CS.borderTop, CS.p2, CS.bgLightBlue)}>
            <a
              className={cx(
                CS.link,
                CS.flex,
                CS.alignCenter,
                CS.textBold,
                CS.textSmall,
              )}
              onClick={this.onAdd}
            >
              <Icon name="add" style={{ marginLeft: 9, marginRight: 17 }} />{" "}
              {t`Set up your own alert`}
            </a>
          </div>
        )}
        {adding && (
          <Modal full onClose={this.onEndAdding}>
            <CreateAlertModalContent
              onCancel={this.onEndAdding}
              onAlertCreated={() => this.onEndAdding(true)}
            />
          </Modal>
        )}
      </div>
    );
  }
}

export default connect(
  state => ({ questionAlerts: getQuestionAlerts(state), user: getUser(state) }),
  null,
)(AlertListPopoverContent);

class AlertListItemInner extends Component {
  state = {
    unsubscribingProgress: null,
    hasJustUnsubscribed: false,
    editing: false,
  };

  onUnsubscribe = async () => {
    const { alert } = this.props;

    try {
      this.setState({ unsubscribingProgress: t`Unsubscribing...` });
      await this.props.unsubscribeFromAlert(alert);
      this.setState({ hasJustUnsubscribed: true });
      this.props.onUnsubscribe(alert);
    } catch (e) {
      this.setState({ unsubscribingProgress: t`Failed to unsubscribe` });
    }
  };

  onEdit = () => {
    this.props.setMenuFreeze(true);
    this.setState({ editing: true });
  };

  onEndEditing = (shouldCloseMenu = false) => {
    this.props.setMenuFreeze(false);
    this.setState({ editing: false });
    if (shouldCloseMenu) {
      this.props.closeMenu();
    }
  };

  render() {
    const { user, alert, highlight } = this.props;
    const { editing, hasJustUnsubscribed, unsubscribingProgress } = this.state;

    const isAdmin = user.is_superuser;
    const isCurrentUser = alert.creator.id === user.id;

    const emailChannel = alert.channels.find(c => c.channel_type === "email");
    const emailEnabled = emailChannel && emailChannel.enabled;
    const slackChannel = alert.channels.find(c => c.channel_type === "slack");
    const slackEnabled = slackChannel && slackChannel.enabled;

    if (hasJustUnsubscribed) {
      return <UnsubscribedListItem />;
    }

    return (
      <li
        className={cx(CS.flex, CS.p3, CS.textMedium, CS.borderBottom, {
          [CS.bgLightBlue]: highlight,
        })}
      >
        <Icon name="alert" size="20" />
        <div className={cx(CS.full, CS.ml2)}>
          <div className={cx(CS.flex, "align-top")}>
            <div>
              <AlertCreatorTitle alert={alert} user={user} />
            </div>
            <div
              className={cx("ml-auto", CS.textBold, CS.textSmall)}
              style={{
                transform: `translateY(4px)`,
              }}
            >
              {(isAdmin || isCurrentUser) && (
                <a className={CS.link} onClick={this.onEdit}>{jt`Edit`}</a>
              )}
              {!isAdmin && !unsubscribingProgress && (
                <a
                  className={cx(CS.link, "ml2")}
                  onClick={this.onUnsubscribe}
                >{jt`Unsubscribe`}</a>
              )}
              {!isAdmin && unsubscribingProgress && (
                <span> {unsubscribingProgress}</span>
              )}
            </div>
          </div>

          {
            // To-do: @kdoh wants to look into overall alignment
          }
          <ul className={cx(CS.flex, CS.mt2, CS.textSmall)}>
            <li className={cx(CS.flex, CS.alignCenter)}>
              <Icon name="clock" size="12" className="mr1" />{" "}
              <AlertScheduleText
                schedule={alert.channels[0]}
                verbose={!isAdmin}
              />
            </li>
            {isAdmin && emailEnabled && (
              <li className={cx(CS.ml3, CS.flex, CS.alignCenter)}>
                <Icon name="mail" className={CS.mr1} />
                {emailChannel.recipients.length}
              </li>
            )}
            {isAdmin && slackEnabled && (
              <li className={cx(CS.ml3, CS.flex, CS.alignCenter)}>
                <Icon name="slack" size={16} className={CS.mr1} />
                {(slackChannel.details &&
                  slackChannel.details.channel.replace("#", "")) ||
                  t`No channel`}
              </li>
            )}
          </ul>
        </div>

        {editing && (
          <Modal full onClose={this.onEndEditing}>
            <UpdateAlertModalContent
              alert={alert}
              onCancel={this.onEndEditing}
              onAlertUpdated={() => this.onEndEditing(true)}
            />
          </Modal>
        )}
      </li>
    );
  }
}

export const AlertListItem = connect(state => ({ user: getUser(state) }), {
  unsubscribeFromAlert,
  deleteAlert,
})(AlertListItemInner);

export const UnsubscribedListItem = () => (
  <li
    className={cx(
      CS.borderBottom,
      CS.flex,
      CS.alignCenter,
      CS.py4,
      CS.textBold,
    )}
  >
    <div
      className={cx(
        "circle",
        CS.flex,
        CS.alignCenter,
        CS.justifyCenter,
        CS.p1,
        CS.bgLight,
        CS.ml2,
      )}
    >
      <Icon name="check" className={CS.textSuccess} />
    </div>
    <h3
      className={CS.textDark}
      style={{ marginLeft: 10 }}
    >{jt`Okay, you're unsubscribed`}</h3>
  </li>
);

export class AlertScheduleText extends Component {
  getScheduleText = () => {
    const { schedule, verbose } = this.props;
    const scheduleType = schedule.schedule_type;

    // these are pretty much copy-pasted from SchedulePicker
    if (scheduleType === "hourly") {
      return verbose ? "hourly" : "Hourly";
    } else if (scheduleType === "daily") {
      const hourOfDay = schedule.schedule_hour;
      const hour = _.find(
        HOUR_OPTIONS,
        opt => opt.value === hourOfDay % 12,
      ).name;
      const amPm = _.find(
        AM_PM_OPTIONS,
        opt => opt.value === (hourOfDay >= 12 ? 1 : 0),
      ).name;

      return `${verbose ? "daily at " : "Daily, "} ${hour} ${amPm}`;
    } else if (scheduleType === "weekly") {
      const hourOfDay = schedule.schedule_hour;
      const dayOfWeekOptions = getDayOfWeekOptions();

      const day = _.find(
        dayOfWeekOptions,
        o => o.value === schedule.schedule_day,
      ).name;
      const hour = _.find(
        HOUR_OPTIONS,
        opt => opt.value === hourOfDay % 12,
      ).name;
      const amPm = _.find(
        AM_PM_OPTIONS,
        opt => opt.value === (hourOfDay >= 12 ? 1 : 0),
      ).name;

      if (verbose) {
        return `weekly on ${day}s at ${hour} ${amPm}`;
      } else {
        // omit the minute part of time
        return `${day}s, ${hour.substr(0, hour.indexOf(":"))} ${amPm}`;
      }
    }
  };

  render() {
    const { verbose } = this.props;

    const scheduleText = this.getScheduleText();

    if (verbose) {
      return (
        <span>
          Checking <b>{scheduleText}</b>
        </span>
      );
    } else {
      return <span>{scheduleText}</span>;
    }
  }
}

export class AlertCreatorTitle extends Component {
  render() {
    const { alert, user } = this.props;

    const isAdmin = user.is_superuser;
    const isCurrentUser = alert.creator.id === user.id;
    const creator =
      alert.creator.id === user.id ? t`You` : alert.creator.common_name;
    const text =
      !isCurrentUser && !isAdmin
        ? t`You're receiving ${creator}'s alerts`
        : t`${creator} set up an alert`;

    return <h3 className={CS.textDark}>{text}</h3>;
  }
}
