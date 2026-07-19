<script setup>
import DashboardLayout from './DashboardLayout.vue';
const props = defineProps({ title:String, subtitle:String });
</script>
<template>
  <DashboardLayout :title="title" :subtitle="subtitle" shell-class="veterinarian-theme">
    <template #nav><slot name="nav" /></template>
    <slot />
  </DashboardLayout>
</template>
