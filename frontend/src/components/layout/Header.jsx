import PropTypes from "prop-types";
import styles from "../../styles/components/Header.module.css";

export const Header = ({ title, subtitle }) => (
  <header className={styles.header}>
    <h1>{title}</h1>
    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
  </header>
);

Header.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
};
