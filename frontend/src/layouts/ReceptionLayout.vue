<script setup>
import DashboardLayout from './DashboardLayout.vue';
defineProps({ title:String, subtitle:String, hideUserPill:Boolean });
</script>
<template>
  <DashboardLayout :title="title" :subtitle="subtitle" hide-sidebar account-path="/recepcion/cuenta" shell-class="calm-workspace-theme reception-calm-theme">
    <template #nav><slot name="nav" /></template>
    <template #top-actions><slot name="top-actions" /></template>
    <slot />
  </DashboardLayout>
</template>
