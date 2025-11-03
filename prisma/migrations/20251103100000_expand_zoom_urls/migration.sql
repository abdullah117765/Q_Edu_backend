-- Expand Zoom URL columns to accommodate full URLs returned by Zoom API
ALTER TABLE `Class`
  MODIFY `zoomJoinUrl` VARCHAR(512) NULL,
  MODIFY `zoomStartUrl` VARCHAR(512) NULL;
