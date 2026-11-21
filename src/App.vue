<script setup>
import DeviceSetupPage from './features/device-setup/DeviceSetupPage.vue'
import VisitSessionPage from './features/visit-session/VisitSessionPage.vue'
</script>

<template>
  <DeviceSetupPage v-slot="{ deviceUuid }">
    <VisitSessionPage :key="deviceUuid" :device-uuid="deviceUuid" />
  </DeviceSetupPage>
</template>
